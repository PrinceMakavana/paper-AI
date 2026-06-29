import { getSubject } from './catalogDataHelpers.js';
import { assertUserHasTokens } from './userTokenHelpers.js';
import { parseSubjectExamQuestion } from '../utils/subjectExamQuestion.js';

function contentToString(content) {
    if (typeof content === 'string') return content;
    if (content == null) return '';
    return JSON.stringify(content);
}

function buildSubjectChatPrompt(subjectMeta, question, markHint) {
    const aliasLine = subjectMeta.knownAs?.trim()
        ? `Also known as: ${subjectMeta.knownAs.trim()}\n`
        : '';

    const markBlock = markHint
        ? `
Exam formatting (required):
- ${markHint.instruction}
- Match length to GTU marking: fewer words for low marks, more structure for high marks.
- Use numbered points or bullets where appropriate for exam papers.
- Do not repeat the mark count in every line; write like a student answering in an exam.`
        : `
Default formatting:
- If the question is factual or definitional, give a direct answer first, then brief explanation.
- If the question asks to compare or list, use clear bullets or a short table-style layout.
- Keep answers exam-focused unless the user asks for a deep tutorial.`;

    return `You are paperAI, a GTU (Gujarat Technological University) exam study assistant.

Subject: ${subjectMeta.subjectName} (${subjectMeta.subjectCode})
${aliasLine}Your job: help GTU students prepare for exams, vivas, and assignments for THIS subject.

Audience: undergraduate engineering/diploma students at GTU. Use simple, clear English. Avoid overly academic jargon unless the subject requires it.

How to answer:
1. Start with the answer immediately. Do NOT use openings like "Based on the context", "According to the textbook", "As an AI", or "Great question".
2. Answer the actual topic asked. If the user mentions marks (e.g. "3 marks"), treat that as length/format guidance only — still answer the full topic.
3. Prefer standard GTU exam style: definition → key points → example (if useful) → short conclusion for longer answers.
4. For programming/technical subjects: include short code or syntax only when it helps; keep snippets minimal and correct.
5. For theory subjects: use precise terms students can write in an exam booklet.
6. If the question is ambiguous, pick the most likely GTU syllabus interpretation and answer it; add one short clarifying line only if needed.
7. If you are not confident about a GTU-specific syllabus detail, give the best standard answer and add one brief line: "Verify with your official syllabus if your branch differs."
8. Do not invent subject codes, paper years, or official GTU policy. Do not claim you read a specific textbook.
9. Do not refuse reasonable study questions. Do not output NOT_FOUND.
10. No markdown headers (#). Plain text, bullets (• or 1. 2. 3.), and short paragraphs are fine.
${markBlock}

Question:
${question}

Answer:`;
}

async function runSubjectChatWithAi({ question, subjectCode, model, userId }) {
    const trimmed = String(question || '').trim();
    const code = String(subjectCode || '').trim();

    if (!trimmed || !code) {
        const error = new Error('Missing question or subjectCode');
        error.statusCode = 400;
        throw error;
    }

    if (userId) {
        await assertUserHasTokens(userId);
    }

    const subjectMeta = await getSubject(code);
    const { retrievalQuestion, markHint } = parseSubjectExamQuestion(trimmed);
    const prompt = buildSubjectChatPrompt(subjectMeta, retrievalQuestion, markHint);
    const response = await model.invoke(prompt);

    return {
        answer: contentToString(response.content).trim(),
        answerSource: 'ai',
        aiTokenCount: response.usage_metadata?.total_tokens ?? 0,
        aiInputTokenCount: response.usage_metadata?.input_tokens ?? 0,
        aiOutputTokenCount: response.usage_metadata?.output_tokens ?? 0,
        subjectMeta,
    };
}

export { buildSubjectChatPrompt, runSubjectChatWithAi };
