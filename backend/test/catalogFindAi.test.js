import tap from 'tap';
import { broadSearchCatalogIndex } from '../helpers/catalogIndexHelpers.js';
import {
    isConfidentLocalMatch,
    runCatalogFindWithAi,
    tryLocalCatalogAnswer,
} from '../helpers/catalogFindAi.js';
import { LOCAL_CATALOG_FIND_TOKEN_COST } from '../helpers/userTokenHelpers.js';

tap.test('tryLocalCatalogAnswer finds PPS book locally', async (t) => {
    const candidates = broadSearchCatalogIndex('PPS Books', { limit: 15 });
    const localResult = tryLocalCatalogAnswer('PPS Books', candidates);

    t.equal(localResult.intent, 'find_material');
    t.ok(localResult.selectedRows.length > 0, 'expected local PPS book rows');
    t.equal(localResult.selectedRows[0].subjectCode, '3110003');
    t.equal(localResult.availability, 'found');
    t.end();
});

tap.test('isConfidentLocalMatch accepts single-subject PPS Books', async (t) => {
    const candidates = broadSearchCatalogIndex('PPS Books', { limit: 15 });
    const localResult = tryLocalCatalogAnswer('PPS Books', candidates);

    t.ok(
        isConfidentLocalMatch('PPS Books', candidates, localResult.selectedRows),
        'expected confident local match for PPS Books'
    );
    t.end();
});

tap.test('isConfidentLocalMatch rejects ambiguous maths books', async (t) => {
    const candidates = broadSearchCatalogIndex('maths books', { limit: 15 });
    const localResult = tryLocalCatalogAnswer('maths books', candidates);

    t.ok(localResult.selectedRows.length > 1, 'expected multiple maths book rows');
    t.notOk(
        isConfidentLocalMatch('maths books', candidates, localResult.selectedRows),
        'expected ambiguous maths books to require AI'
    );
    t.end();
});

tap.test('isConfidentLocalMatch accepts confident local not-found paper requests', async (t) => {
    const candidates = broadSearchCatalogIndex('pps summer 2010 paper', { limit: 15 });
    const localResult = tryLocalCatalogAnswer('pps summer 2010 paper', candidates);

    t.equal(localResult.selectedRows.length, 0);
    t.equal(localResult.availability, 'not_available');
    t.ok(
        isConfidentLocalMatch('pps summer 2010 paper', candidates, localResult.selectedRows),
        'expected confident local not-found for specific paper request'
    );
    t.end();
});

tap.test('runCatalogFindWithAi bills 600 for confident local PPS Books', async (t) => {
    const result = await runCatalogFindWithAi({ question: 'PPS Books', model: {} });

    t.equal(result.answerSource, 'local');
    t.equal(result.aiTokenCount, LOCAL_CATALOG_FIND_TOKEN_COST);
    t.ok(result.selectedRows.length > 0);
    t.end();
});

tap.test('runCatalogFindWithAi bills 0 for confident local not-found paper', async (t) => {
    const result = await runCatalogFindWithAi({ question: 'pps summer 2010 paper', model: {} });

    t.equal(result.answerSource, 'local');
    t.equal(result.aiTokenCount, 0);
    t.equal(result.availability, 'not_available');
    t.end();
});

tap.test('runCatalogFindWithAi uses AI path for ambiguous maths books', async (t) => {
    const invoked = { count: 0 };
    const model = {
        async invoke() {
            invoked.count += 1;
            return {
                content: JSON.stringify({
                    intent: 'find_material',
                    selectedIds: [],
                    answer: 'DATA_NOT_AVAILABLE',
                    suggestedSubjectCodes: [],
                }),
                usage_metadata: {
                    total_tokens: 1800,
                    input_tokens: 1500,
                    output_tokens: 300,
                },
            };
        },
    };

    const result = await runCatalogFindWithAi({ question: 'maths books', model });

    t.equal(invoked.count, 1, 'expected AI invoke for ambiguous maths books');
    t.equal(result.answerSource, 'ai');
    t.equal(result.aiTokenCount, 1800);
    t.end();
});

tap.test('runCatalogFindWithAi uses local path for explicit subject code query', async (t) => {
    const invoked = { count: 0 };
    const model = {
        async invoke() {
            invoked.count += 1;
            return {
                content: JSON.stringify({
                    intent: 'find_material',
                    selectedIds: ['2170715:subject:2170715'],
                    answer: 'wrong subject',
                    suggestedSubjectCodes: [],
                }),
                usage_metadata: {
                    total_tokens: 1500,
                    input_tokens: 1300,
                    output_tokens: 200,
                },
            };
        },
    };

    const result = await runCatalogFindWithAi({ question: '3110002 data', model });

    t.equal(invoked.count, 0, 'expected local path without AI for explicit subject code');
    t.equal(result.answerSource, 'local');
    t.equal(result.aiTokenCount, LOCAL_CATALOG_FIND_TOKEN_COST);
    t.ok(result.selectedRows.every((row) => row.subjectCode === '3110002'));
    t.end();
});

tap.test('isConfidentLocalMatch accepts explicit subject code with generic token', async (t) => {
    const candidates = broadSearchCatalogIndex('3110002 data', { limit: 15 });
    const localResult = tryLocalCatalogAnswer('3110002 data', candidates);

    t.ok(
        isConfidentLocalMatch('3110002 data', candidates, localResult.selectedRows),
        'expected confident local match when subject code is explicit'
    );
    t.end();
});

tap.teardown(() => {
    process.exit(0);
});
