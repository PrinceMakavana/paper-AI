import tap from 'tap';
import {
    buildDataNotAvailableAnswer,
    paperLabelMatchesConstraints,
    parseFindMaterialConstraints,
    validateSelectedRowsForQuestion,
} from '../helpers/catalogQueryHelpers.js';
import { resolveFindMaterialAnswer } from '../helpers/catalogFindAi.js';

tap.test('parseFindMaterialConstraints reads summer 2010 paper request', async (t) => {
    const constraints = parseFindMaterialConstraints('maths summer 2010 paper');
    t.equal(constraints.season, 'summer');
    t.equal(constraints.year, '2010');
    t.equal(constraints.hasSpecificPaperRequest, true);
    t.end();
});

tap.test('paperLabelMatchesConstraints rejects wrong year', async (t) => {
    const constraints = parseFindMaterialConstraints('maths summer 2010 paper');
    t.equal(paperLabelMatchesConstraints('Summer-2023', constraints), false);
    t.equal(paperLabelMatchesConstraints('Summer-10', constraints), true);
    t.end();
});

tap.test('validateSelectedRowsForQuestion filters non-matching paper years', async (t) => {
    const constraints = parseFindMaterialConstraints('maths summer 2010 paper');
    const rows = [
        {
            materialType: 'old_paper',
            label: 'Summer-2023',
            url: 'https://example.com/2023.pdf',
        },
        {
            materialType: 'old_paper',
            label: 'Summer-10',
            url: 'https://example.com/2010.pdf',
        },
    ];

    const validated = validateSelectedRowsForQuestion(rows, constraints);
    t.equal(validated.length, 1);
    t.equal(validated[0].label, 'Summer-10');
    t.end();
});

tap.test('resolveFindMaterialAnswer returns not available message for missing summer 2010', async (t) => {
    process.env.CATALOG_CONTRIBUTE_FORM_URL =
        'https://docs.google.com/forms/d/e/1FAIpQLSfHD_cTiKkxgR38sxyxO_AIbGX9wTasP6z-KIvmL2JP8eJqtw/viewform';

    const constraints = parseFindMaterialConstraints('maths summer 2010 paper');
    const { answer, selectedRows } = resolveFindMaterialAnswer({
        question: 'maths summer 2010 paper',
        constraints,
        selectedRows: [
            {
                materialType: 'old_paper',
                label: 'Summer-2023',
                url: 'https://example.com/2023.pdf',
            },
        ],
        parsedAnswer: 'Here are some papers',
    });

    t.equal(selectedRows.length, 0);
    t.match(answer, /Data is not available right now/i);
    t.match(answer, /summer.*2010/i);
    t.match(answer, /contribute this material here/i);
    t.end();
});

tap.test('buildDataNotAvailableAnswer omits link when env unset', async (t) => {
    delete process.env.CATALOG_CONTRIBUTE_FORM_URL;
    const answer = buildDataNotAvailableAnswer({
        question: 'maths summer 2010 paper',
        constraints: parseFindMaterialConstraints('maths summer 2010 paper'),
    });
    t.match(answer, /Data is not available right now/i);
    t.notMatch(answer, /contribute this material here/i);
    t.end();
});

tap.teardown(() => {
    process.exit(0);
});
