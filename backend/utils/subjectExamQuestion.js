/**
 * Splits exam-format metadata (e.g. "3 mark question") from the topic for retrieval.
 */
function parseSubjectExamQuestion(question) {
    const originalQuestion = String(question || '').trim();
    if (!originalQuestion) {
        return { originalQuestion: '', retrievalQuestion: '', markHint: null };
    }

    const markMatch = originalQuestion.match(/\b(\d+)\s*-?\s*marks?\b/i);
    const marks = markMatch ? Number(markMatch[1]) : null;

    const stripPatterns = [
        /\s*[\(\[]\s*(?:give\s+(?:me\s+)?)?(?:ans(?:wer)?\s+)?as\s+(?:a\s+)?\d+\s*-?\s*marks?\s+(?:question|answer|ans)\s*[\)\]]\s*/gi,
        /\s*[,.]?\s*(?:give\s+(?:me\s+)?)?(?:ans(?:wer)?\s+)?as\s+(?:a\s+)?\d+\s*-?\s*marks?\s+(?:question|answer|ans)\s*$/gi,
        /\s*[,.]?\s*for\s+(?:a\s+)?\d+\s*-?\s*marks?\s*(?:exam\s+)?(?:answer|question)?\s*$/gi,
        /\s*[,.]?\s*(?:in\s+)?\d+\s*-?\s*marks?\s*(?:format)?\s*$/gi,
    ];

    let retrievalQuestion = originalQuestion;
    for (const pattern of stripPatterns) {
        retrievalQuestion = retrievalQuestion.replace(pattern, '').trim();
    }
    retrievalQuestion = retrievalQuestion.replace(/[.,]\s*$/, '').trim();

    if (!retrievalQuestion) {
        retrievalQuestion = originalQuestion;
    }

    const wantsExamFormat =
        marks != null ||
        /\bmark\s+question\b/i.test(originalQuestion) ||
        /\bmarks?\s+answer\b/i.test(originalQuestion) ||
        /\bexam\s+(?:style\s+)?answer\b/i.test(originalQuestion);

    let markHint = null;
    if (wantsExamFormat) {
        markHint = marks
            ? {
                  marks,
                  instruction: `Format as a concise ${marks}-mark GTU exam answer (short points, exam-appropriate length).`,
              }
            : {
                  marks: null,
                  instruction: 'Format as a concise GTU exam-style answer (short points, exam-appropriate length).',
              };
    }

    return { originalQuestion, retrievalQuestion, markHint };
}

module.exports = { parseSubjectExamQuestion };
