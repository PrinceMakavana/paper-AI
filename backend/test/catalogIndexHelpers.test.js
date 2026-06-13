import tap from 'tap';
import {
    broadSearchCatalogIndex,
    buildCatalogIndex,
    getCatalogRowsByIds,
} from '../helpers/catalogIndexHelpers.js';

tap.test('buildCatalogIndex includes old papers and books', async (t) => {
    const index = buildCatalogIndex();
    t.ok(index.length > 100, 'expected a large catalog index');

    const mathsPaper = index.find(
        (row) =>
            row.subjectCode === '3110015' &&
            row.materialType === 'old_paper' &&
            row.label === 'Summer-2023'
    );
    t.ok(mathsPaper, 'expected Mathematics II Summer-2023 paper row');
    t.match(mathsPaper.url, /3110015\.pdf/);
    t.end();
});

tap.test('broadSearchCatalogIndex finds maths summer 2023 paper', async (t) => {
    const results = broadSearchCatalogIndex('give me summer 2023 old paper link of maths', {
        limit: 20,
    });

    t.ok(results.length > 0, 'expected search results');
    const topMatch = results.find(
        (row) => row.subjectCode === '3110015' && row.label === 'Summer-2023'
    );
    t.ok(topMatch, 'expected Mathematics II Summer-2023 near top of results');
    t.end();
});

tap.test('broadSearchCatalogIndex limits PPS Books to PPS subject rows', async (t) => {
    const results = broadSearchCatalogIndex('PPS Books', { limit: 55 });

    t.ok(results.length > 0, 'expected PPS search results');
    t.ok(
        results.every((row) => row.subjectCode === '3110003'),
        'expected only Programming For Problem Solving rows'
    );
    t.ok(
        results.some((row) => row.materialType === 'book'),
        'expected at least one PPS book row'
    );
    t.end();
});

tap.test('getCatalogRowsByIds returns only known ids', async (t) => {
    const index = buildCatalogIndex();
    const sample = index[0];
    const rows = getCatalogRowsByIds([sample.id, 'missing:id']);
    t.equal(rows.length, 1);
    t.equal(rows[0].id, sample.id);
    t.end();
});

tap.teardown(() => {
    process.exit(0);
});
