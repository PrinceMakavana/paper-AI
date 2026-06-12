import {
    broadSearchCatalogIndex,
    getCatalogRowsByIds,
    groupMatchesBySubject,
} from './catalogIndexHelpers.js';
import {
    buildDataNotAvailableAnswer,
    parseFindMaterialConstraints,
    validateSelectedRowsForQuestion,
} from './catalogQueryHelpers.js';

const STUDY_QUESTION_PATTERN =
    /\b(explain|define|what is|what are|how does|how do|why does|describe|difference between|marks?|viva|assignment answer|solve this|help me understand)\b/i;

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

function compactCandidates(candidates) {
    return candidates.map((row) => ({
        id: row.id,
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        knownAs: row.knownAs,
        materialType: row.materialType,
        label: row.label,
        url: row.url,
        chatReady: row.chatReady,
    }));
}

function buildCatalogFindPrompt(question, candidates) {
    const candidateJson = JSON.stringify(compactCandidates(candidates), null, 2);

    return `You are the GTU Material Finder for paperAI. Your job is to help students FIND links (books, syllabus, old exam papers, solutions) across GTU subjects.

You are NOT a tutor. Never explain academic topics.

USER QUESTION:
${question.trim()}

CANDIDATE CATALOG ROWS (you may ONLY use these ids and urls — never invent links):
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
4. For find_material answer: include markdown links using ONLY selected candidates' url fields. Mention subject code and name.
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

async function runCatalogFindWithAi({ question, model }) {
    const trimmed = String(question || '').trim();
    if (!trimmed) {
        const error = new Error('Missing question');
        error.statusCode = 400;
        throw error;
    }

    const candidates = broadSearchCatalogIndex(trimmed, { limit: 55 });

    if (looksLikeStudyQuestion(trimmed) && candidates.length === 0) {
        return {
            intent: 'study_question',
            selectedRows: [],
            answer: buildStudyRedirectAnswer([], []),
            suggestedSubjectCodes: [],
            matches: [],
            aiTokenCount: 0,
            aiInputTokenCount: 0,
            aiOutputTokenCount: 0,
        };
    }

    if (!model) {
        const constraints = parseFindMaterialConstraints(trimmed);
        if (looksLikeStudyQuestion(trimmed)) {
            return {
                intent: 'study_question',
                selectedRows: [],
                answer: buildStudyRedirectAnswer([], candidates),
                suggestedSubjectCodes: [],
                availability: 'redirect',
                matches: [],
                aiTokenCount: 0,
                aiInputTokenCount: 0,
                aiOutputTokenCount: 0,
            };
        }

        const { answer, selectedRows } = resolveFindMaterialAnswer({
            question: trimmed,
            constraints,
            selectedRows: candidates.slice(0, 8),
            parsedAnswer: '',
        });

        return {
            intent: 'find_material',
            selectedRows,
            answer,
            suggestedSubjectCodes: [],
            availability: selectedRows.length ? 'found' : 'not_available',
            matches: groupMatchesBySubject(selectedRows),
            aiTokenCount: 0,
            aiInputTokenCount: 0,
            aiOutputTokenCount: 0,
        };
    }

    const prompt = buildCatalogFindPrompt(trimmed, candidates);
    const response = await model.invoke(prompt);
    const parsed = parseJsonFromModelText(contentToString(response.content));
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
                  selectedRows: candidates.slice(0, 8),
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

    return {
        ...normalized,
        matches: groupMatchesBySubject(normalized.selectedRows),
        aiTokenCount: response.usage_metadata?.total_tokens ?? 0,
        aiInputTokenCount: response.usage_metadata?.input_tokens ?? 0,
        aiOutputTokenCount: response.usage_metadata?.output_tokens ?? 0,
    };
}

export {
    buildCatalogFindPrompt,
    formatFallbackFindAnswer,
    looksLikeStudyQuestion,
    parseJsonFromModelText,
    resolveFindMaterialAnswer,
    runCatalogFindWithAi,
};
