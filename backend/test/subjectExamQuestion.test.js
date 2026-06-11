import { test } from 'tap';
import { parseSubjectExamQuestion } from '../utils/subjectExamQuestion.js';

test('parseSubjectExamQuestion strips 3 mark formatting from retrieval query', (t) => {
    const result = parseSubjectExamQuestion(
        'List out different data types available in java (give me ans as 3 mark question)'
    );

    t.equal(result.retrievalQuestion, 'List out different data types available in java');
    t.equal(result.markHint?.marks, 3);
    t.match(result.markHint?.instruction, /3-mark/);
    t.end();
});

test('parseSubjectExamQuestion leaves plain questions unchanged', (t) => {
    const result = parseSubjectExamQuestion('List out different data types available in java');

    t.equal(result.retrievalQuestion, 'List out different data types available in java');
    t.equal(result.markHint, null);
    t.end();
});

test('parseSubjectExamQuestion handles trailing mark suffix', (t) => {
    const result = parseSubjectExamQuestion('Explain inheritance in java as 5 mark answer');

    t.equal(result.retrievalQuestion, 'Explain inheritance in java');
    t.equal(result.markHint?.marks, 5);
    t.end();
});
