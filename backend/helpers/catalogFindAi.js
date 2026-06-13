import {
    broadSearchCatalogIndex,
    extractSubjectCodeFromQuery,
    getCatalogRowsByIds,
    groupMatchesBySubject,
    rowMatchesSubjectQuery,
    tokenize,
} from './catalogIndexHelpers.js';
import {
    buildDataNotAvailableAnswer,
    parseFindMaterialConstraints,
    validateSelectedRowsForQuestion,
} from './catalogQueryHelpers.js';
import {
    LOCAL_CATALOG_FIND_TOKEN_COST,
    assertUserHasMinTokens,
    assertUserHasTokens,
} from './userTokenHelpers.js';

const STUDY_QUESTION_PATTERN =
    /\b(explain|define|what is|what are|how does|how do|why does|describe|difference between|marks?|viva|assignment answer|solve this|help me understand)\b/i;

const AI_CANDIDATE_LIMIT = 15;
const LOCAL_CANDIDATE_LIMIT = 8;

function logCatalogFind(step, data = {}) {
    console.log('[CatalogFind]', step, JSON.stringify(data, null, 2));
}

function summarizeCandidates(candidates = []) {
    const subjectCodes = [...new Set(candidates.map((row) => row.subjectCode))];
    return {
        count: candidates.length,
        subjectCodes,
        rows: candidates.map((row) => ({
            id: row.id,
            subjectCode: row.subjectCode,
            materialType: row.materialType,
            label: row.label,
        })),
    };
}

function summarizeSelectedRows(rows = []) {
    return {
        count: rows.length,
        subjectCodes: [...new Set(rows.map((row) => row.subjectCode))],
        materialTypes: [...new Set(rows.map((row) => row.materialType))],
    };
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function queryContainsTerm(query, term) {
    const normalizedTerm = String(term || '').trim().toLowerCase();
    if (!normalizedTerm) return false;
    const pattern = new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, 'i');
    return pattern.test(String(query || '').toLowerCase());
}

function contentToString(content) {
    if (typeof content === 'string') return content;
    if (content == null) return '';
    return JSON.stringify(content);
}

function parseJsonFromModelText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced ? fenced[1] : raw).trim();

    try {
        return JSON.parse(candidate);
    } catch {
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(candidate.slice(start, end + 1));
            } catch {
                return null;
            }
        }
        return null;
    }
}

function looksLikeStudyQuestion(question) {
    return STUDY_QUESTION_PATTERN.test(String(question || ''));
}

function compactCandidatesForPrompt(candidates) {
    return candidates.map((row) => ({
        id: row.id,
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        knownAs: row.knownAs,
        materialType: row.materialType,
        label: row.label,
        chatReady: row.chatReady,
    }));
}

function buildCatalogFindPrompt(question, candidates) {
    const candidateJson = JSON.stringify(compactCandidatesForPrompt(candidates));

    return `You are the GTU Material Finder for paperAI. Your job is to help students FIND links (books, syllabus, old exam papers, solutions) across GTU subjects.

You are NOT a tutor. Never explain academic topics.

USER QUESTION:
${question.trim()}

CANDIDATE CATALOG ROWS (you may ONLY use these ids — never invent links):
${candidateJson}

Return ONLY valid JSON with this shape:
{
  "intent": "find_material" | "study_question",
  "selectedIds": ["row-id", "..."],
  "answer": "short markdown answer for the user",
  "suggestedSubjectCodes": ["3110003"]
}

Rules:
1. If the user wants links/resources (books, syllabus, papers, downloads, "give me", subject codes): intent = "find_material".
2. If the user wants explanations/definitions/exam answers ("explain", "what is", "define", marks): intent = "study_question".
3. For find_material: pick the best matching candidate ids. Match subject aliases (e.g. maths -> Mathematics, PPS -> Programming For Problem Solving). Match paper seasons/years exactly (e.g. "summer 2023" -> label "Summer-2023").
4. For find_material answer: mention subject code and name. Use markdown link labels only; selected ids are resolved to urls server-side.
5. For study_question: selectedIds must be []. answer must tell the user to select a subject for textbook answers. suggestedSubjectCodes = up to 5 relevant subject codes from candidates where chatReady is true; if none, use closest subject matches anyway.
6. If the user asks for a specific exam season/year (e.g. "summer 2010 paper") and NO candidate has that exact season+year label, return selectedIds = [] and answer = "DATA_NOT_AVAILABLE".
7. Never return a different year/season as a substitute (e.g. do not return Summer-2023 when the user asked for Summer-2010).
8. If nothing else matches: selectedIds = [], answer = "DATA_NOT_AVAILABLE".
9. Do not include any text outside the JSON object.`;
}

function resolveFindMaterialAnswer({ question, constraints, selectedRows, parsedAnswer }) {
    const validatedRows = validateSelectedRowsForQuestion(selectedRows, constraints);

    if (validatedRows.length) {
        const aiAnswer = String(parsedAnswer || '').trim();
        if (aiAnswer && !/^DATA_NOT_AVAILABLE$/i.test(aiAnswer)) {
            return { answer: aiAnswer, selectedRows: validatedRows };
        }
        return { answer: formatFallbackFindAnswer(validatedRows), selectedRows: validatedRows };
    }

    return {
        answer: buildDataNotAvailableAnswer({ question, constraints }),
        selectedRows: [],
    };
}

function formatFallbackFindAnswer(rows) {
    if (!rows.length) {
        return buildDataNotAvailableAnswer();
    }

    const grouped = groupMatchesBySubject(rows);
    const lines = ['Here is what I found in the catalog:', ''];

    for (const subject of grouped) {
        const alias = subject.knownAs ? ` (${subject.knownAs})` : '';
        lines.push(`**${subject.subjectCode} – ${subject.subjectName}**${alias}`);
        for (const item of subject.items) {
            lines.push(`- [${item.label}](${item.url})`);
        }
        lines.push('');
    }

    return lines.join('\n').trim();
}

function buildStudyRedirectAnswer(suggestedSubjectCodes, candidates) {
    const codeSet = new Set(suggestedSubjectCodes);
    const suggestions = candidates.filter(
        (row) => codeSet.has(row.subjectCode) && row.materialType === 'subject'
    );

    const unique = [];
    const seen = new Set();
    for (const row of suggestions.length ? suggestions : candidates) {
        if (row.materialType !== 'subject' || seen.has(row.subjectCode)) continue;
        seen.add(row.subjectCode);
        unique.push(row);
        if (unique.length >= 5) break;
    }

    const lines = [
        'This looks like a study question. Please **select a subject** to get answers from indexed textbooks.',
        '',
    ];

    if (unique.length) {
        lines.push('Subjects that may be relevant:');
        for (const row of unique) {
            const alias = row.knownAs ? ` (${row.knownAs})` : '';
            const chatNote = row.chatReady ? ' — textbook chat available' : '';
            lines.push(`- **${row.subjectCode}** – ${row.subjectName}${alias}${chatNote}`);
        }
    }

    return lines.join('\n');
}

function tryLocalCatalogAnswer(question, candidates) {
    const trimmed = String(question || '').trim();
    const constraints = parseFindMaterialConstraints(trimmed);

    if (looksLikeStudyQuestion(trimmed)) {
        return {
            intent: 'study_question',
            selectedRows: [],
            answer: buildStudyRedirectAnswer([], candidates),
            suggestedSubjectCodes: [],
            availability: 'redirect',
        };
    }

    const { answer, selectedRows } = resolveFindMaterialAnswer({
        question: trimmed,
        constraints,
        selectedRows: candidates.slice(0, LOCAL_CANDIDATE_LIMIT),
        parsedAnswer: '',
    });

    return {
        intent: 'find_material',
        selectedRows,
        answer,
        suggestedSubjectCodes: [],
        availability: selectedRows.length ? 'found' : 'not_available',
    };
}

function countMatchingSubjectCodes(candidates, question) {
    const explicitSubjectCode = extractSubjectCodeFromQuery(question);
    if (explicitSubjectCode) {
        return candidates.some((row) => row.subjectCode === explicitSubjectCode) ? 1 : 0;
    }

    const normalizedQuery = String(question || '').toLowerCase().trim();
    const constraints = parseFindMaterialConstraints(question);
    const tokens = tokenize(normalizedQuery).filter((token) => {
        if (constraints.season && token === constraints.season) return false;
        if (constraints.year) {
            const shortYear = constraints.year.slice(-2);
            if (token === constraints.year || token === shortYear) return false;
        }
        return true;
    });
    const subjectCodes = new Set();

    for (const row of candidates) {
        if (rowMatchesSubjectQuery(row, tokens, normalizedQuery)) {
            subjectCodes.add(row.subjectCode);
        }
    }

    return subjectCodes.size;
}

function isConfidentLocalMatch(question, candidates, selectedRows) {
    if (looksLikeStudyQuestion(question)) {
        return false;
    }

    const explicitSubjectCode = extractSubjectCodeFromQuery(question);
    if (explicitSubjectCode) {
        if (selectedRows.some((row) => row.subjectCode === explicitSubjectCode)) {
            return true;
        }

        if (!selectedRows.length) {
            const constraints = parseFindMaterialConstraints(question);
            return constraints.hasSpecificPaperRequest
                && candidates.some((row) => row.subjectCode === explicitSubjectCode);
        }
    }

    if (countMatchingSubjectCodes(candidates, question) > 1) {
        return false;
    }

    if (!selectedRows.length) {
        const constraints = parseFindMaterialConstraints(question);
        return constraints.hasSpecificPaperRequest;
    }

    const subjectCodes = new Set(selectedRows.map((row) => row.subjectCode));
    if (subjectCodes.size === 1) {
        return true;
    }

    const top = candidates[0];
    if (top?.knownAs && queryContainsTerm(question, top.knownAs)) {
        return true;
    }

    return false;
}

function getLocalCatalogTokenCost(selectedRows) {
    return selectedRows.length > 0 ? LOCAL_CATALOG_FIND_TOKEN_COST : 0;
}

function buildLocalCatalogResult(localResult) {
    const tokenCost = getLocalCatalogTokenCost(localResult.selectedRows);

    return {
        ...localResult,
        matches: groupMatchesBySubject(localResult.selectedRows),
        answerSource: 'local',
        aiTokenCount: tokenCost,
        aiInputTokenCount: 0,
        aiOutputTokenCount: 0,
    };
}

function normalizeAiCatalogResult(parsed, candidates, question) {
    const candidateIds = new Set(candidates.map((row) => row.id));
    const constraints = parseFindMaterialConstraints(question);
    const intent = parsed?.intent === 'study_question' || looksLikeStudyQuestion(question)
        ? 'study_question'
        : 'find_material';

    if (intent === 'study_question') {
        const suggestedSubjectCodes = Array.isArray(parsed?.suggestedSubjectCodes)
            ? parsed.suggestedSubjectCodes.map(String)
            : [];
        return {
            intent,
            selectedRows: [],
            answer: buildStudyRedirectAnswer(suggestedSubjectCodes, candidates),
            suggestedSubjectCodes: suggestedSubjectCodes.slice(0, 5),
            availability: 'redirect',
        };
    }

    const selectedIds = Array.isArray(parsed?.selectedIds)
        ? parsed.selectedIds.filter((id) => candidateIds.has(String(id)))
        : [];
    const selectedRows = getCatalogRowsByIds(selectedIds);
    const parsedAnswer = String(parsed?.answer || '').trim();
    const { answer, selectedRows: validatedRows } = resolveFindMaterialAnswer({
        question,
        constraints,
        selectedRows,
        parsedAnswer,
    });

    return {
        intent: 'find_material',
        selectedRows: validatedRows,
        answer,
        suggestedSubjectCodes: [],
        availability: validatedRows.length ? 'found' : 'not_available',
    };
}

async function runCatalogFindWithAi({ question, model, userId }) {
    const trimmed = String(question || '').trim();
    if (!trimmed) {
        const error = new Error('Missing question');
        error.statusCode = 400;
        throw error;
    }

    const candidates = broadSearchCatalogIndex(trimmed, { limit: AI_CANDIDATE_LIMIT });
    const explicitSubjectCode = extractSubjectCodeFromQuery(trimmed);
    const localResult = tryLocalCatalogAnswer(trimmed, candidates);
    const confidentLocal = isConfidentLocalMatch(trimmed, candidates, localResult.selectedRows);

    logCatalogFind('search', {
        question: trimmed,
        explicitSubjectCode,
        candidates: summarizeCandidates(candidates),
    });
    logCatalogFind('local_attempt', {
        intent: localResult.intent,
        availability: localResult.availability,
        confidentLocal,
        matchingSubjectCount: countMatchingSubjectCodes(candidates, trimmed),
        selectedRows: summarizeSelectedRows(localResult.selectedRows),
    });

    if (confidentLocal) {
        const tokenCost = getLocalCatalogTokenCost(localResult.selectedRows);
        if (userId && tokenCost > 0) {
            await assertUserHasMinTokens(userId, tokenCost);
        }
        const result = buildLocalCatalogResult(localResult);
        logCatalogFind('local_result', {
            answerSource: result.answerSource,
            tokenCost: result.aiTokenCount,
            availability: result.availability,
        });
        return result;
    }

    if (!model) {
        const tokenCost = getLocalCatalogTokenCost(localResult.selectedRows);
        if (userId && tokenCost > 0) {
            await assertUserHasMinTokens(userId, tokenCost);
        }
        const result = buildLocalCatalogResult(localResult);
        logCatalogFind('local_fallback_no_model', {
            answerSource: result.answerSource,
            tokenCost: result.aiTokenCount,
        });
        return result;
    }

    if (userId) {
        await assertUserHasTokens(userId);
    }

    logCatalogFind('ai_invoke', {
        reason: 'not_confident_local',
        candidateCount: candidates.length,
    });

    const prompt = buildCatalogFindPrompt(trimmed, candidates);
    const response = await model.invoke(prompt);
    const parsed = parseJsonFromModelText(contentToString(response.content));

    logCatalogFind('ai_response', {
        parsedIntent: parsed?.intent ?? null,
        selectedIds: parsed?.selectedIds ?? [],
        tokenUsage: {
            total: response.usage_metadata?.total_tokens ?? 0,
            input: response.usage_metadata?.input_tokens ?? 0,
            output: response.usage_metadata?.output_tokens ?? 0,
        },
        promptChars: prompt.length,
    });

    const normalized = parsed
        ? normalizeAiCatalogResult(parsed, candidates, trimmed)
        : (() => {
              const constraints = parseFindMaterialConstraints(trimmed);
              if (looksLikeStudyQuestion(trimmed)) {
                  return {
                      intent: 'study_question',
                      selectedRows: [],
                      answer: buildStudyRedirectAnswer([], candidates),
                      suggestedSubjectCodes: [],
                      availability: 'redirect',
                  };
              }
              const resolved = resolveFindMaterialAnswer({
                  question: trimmed,
                  constraints,
                  selectedRows: candidates.slice(0, LOCAL_CANDIDATE_LIMIT),
                  parsedAnswer: '',
              });
              return {
                  intent: 'find_material',
                  selectedRows: resolved.selectedRows,
                  answer: resolved.answer,
                  suggestedSubjectCodes: [],
                  availability: resolved.selectedRows.length ? 'found' : 'not_available',
              };
          })();

    const result = {
        ...normalized,
        matches: groupMatchesBySubject(normalized.selectedRows),
        answerSource: 'ai',
        aiTokenCount: response.usage_metadata?.total_tokens ?? 0,
        aiInputTokenCount: response.usage_metadata?.input_tokens ?? 0,
        aiOutputTokenCount: response.usage_metadata?.output_tokens ?? 0,
    };

    logCatalogFind('ai_result', {
        answerSource: result.answerSource,
        intent: result.intent,
        availability: result.availability,
        tokenCost: result.aiTokenCount,
        selectedRows: summarizeSelectedRows(result.selectedRows),
    });

    return result;
}

export {
    buildCatalogFindPrompt,
    formatFallbackFindAnswer,
    isConfidentLocalMatch,
    looksLikeStudyQuestion,
    parseJsonFromModelText,
    resolveFindMaterialAnswer,
    runCatalogFindWithAi,
    tryLocalCatalogAnswer,
};
