import tap from 'tap';
import { buildSubjectChatPrompt } from '../helpers/subjectChatAi.js';

const subjectMeta = {
    subjectCode: '3110003',
    subjectName: 'Programming For Problem Solving',
    knownAs: 'PPS',
};

tap.test('buildSubjectChatPrompt includes subject metadata and question', (t) => {
    const prompt = buildSubjectChatPrompt(subjectMeta, 'What is a variable?', null);

    t.match(prompt, /Programming For Problem Solving \(3110003\)/);
    t.match(prompt, /Also known as: PPS/);
    t.match(prompt, /What is a variable\?/);
    t.match(prompt, /Do not output NOT_FOUND/);
    t.notMatch(prompt, /Textbook excerpts/);
    t.end();
});

tap.test('buildSubjectChatPrompt includes exam formatting when mark hint is set', (t) => {
    const prompt = buildSubjectChatPrompt(subjectMeta, 'Explain loops', {
        marks: 3,
        instruction: 'Format as a concise 3-mark GTU exam answer (short points, exam-appropriate length).',
    });

    t.match(prompt, /Exam formatting \(required\)/);
    t.match(prompt, /3-mark GTU exam answer/);
    t.end();
});

tap.test('buildSubjectChatPrompt omits alias line when knownAs is empty', (t) => {
    const prompt = buildSubjectChatPrompt(
        { ...subjectMeta, knownAs: '' },
        'Define array',
        null
    );

    t.notMatch(prompt, /Also known as:/);
    t.match(prompt, /Default formatting/);
    t.end();
});
