import { loadAllCatalogSubjects, mapMaterialFilesForClient } from './catalogDataHelpers.js';

const CATALOG_GLOBAL_SESSION_ID = 'catalog:global';

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'of', 'for', 'to', 'me', 'my', 'give', 'get', 'find', 'show',
    'please', 'link', 'links', 'url', 'download', 'old', 'paper', 'papers', 'book', 'books',
    'syllabus', 'material', 'materials', 'subject', 'gtu',
]);

let cachedIndex = null;

function slugify(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '');
}

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9+\s-]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function inferBookId(book, subjectCode, index) {
    if (book.book_id) return String(book.book_id);
    return `${subjectCode}-${index}`;
}

function countReadyBooks(books = []) {
    return books.filter((book) => book.pageindex_status === 'ready' && book.pageindex_s3_uri).length;
}

function buildRow({
    id,
    subjectCode,
    subjectName,
    knownAs,
    materialType,
    label,
    url,
    chatReady,
    searchableText,
}) {
    return {
        id,
        subjectCode,
        subjectName: subjectName?.trim() || subjectCode,
        knownAs: knownAs?.trim() || '',
        materialType,
        label: label?.trim() || '',
        url: url?.trim() || '',
        chatReady: !!chatReady,
        searchableText: searchableText.toLowerCase(),
    };
}

function addMaterialFileRows({
    rows,
    subject,
    field,
    materialType,
    label,
    subjectCode,
    subjectName,
    knownAs,
    chatReady,
    searchableText,
}) {
    const files = mapMaterialFilesForClient(subject[field], label);

    files.forEach((file, index) => {
        if (!file.url) return;
        rows.push(
            buildRow({
                id: `${subjectCode}:${materialType}:${slugify(file.title || file.originalName) || index}`,
                subjectCode,
                subjectName,
                knownAs,
                materialType,
                label: file.title || file.originalName || label,
                url: file.url,
                chatReady,
                searchableText: `${searchableText} ${label} ${file.title || ''} ${file.originalName || ''}`,
            })
        );
    });
}

async function buildCatalogIndex() {
    const subjects = await loadAllCatalogSubjects();
    const rows = [];

    for (const subject of subjects) {
        const code = String(subject.subjecet_code || subject.subject_code || '').trim();
        if (!code) continue;

        const subjectName = subject.subject_name || '';
        const knownAs = subject.known_as || '';
        const books = subject.Books || [];
        const readyCount = subject.indexed_book_count ?? countReadyBooks(books);
        const chatReady = readyCount > 0;
        const subjectHaystack = [code, subjectName, knownAs].filter(Boolean).join(' ');

        rows.push(
            buildRow({
                id: `${code}:subject:${code}`,
                subjectCode: code,
                subjectName,
                knownAs,
                materialType: 'subject',
                label: subjectName || code,
                url: '',
                chatReady,
                searchableText: subjectHaystack,
            })
        );

        [
            ['syllabus', 'syllabus', 'Syllabus'],
            ['paper_solution', 'paper_solution', 'Paper solutions'],
            ['prectical', 'prectical', 'Practical'],
            ['viva_questions', 'viva_questions', 'Viva questions'],
            ['imp_material', 'imp_material', 'Important material'],
            ['assignments', 'assignments', 'Assignments'],
        ].forEach(([field, materialType, label]) => {
            addMaterialFileRows({
                rows,
                subject,
                field,
                materialType,
                label,
                subjectCode: code,
                subjectName,
                knownAs,
                chatReady,
                searchableText: subjectHaystack,
            });
        });

        for (const paper of subject.old_paper || []) {
            if (!paper?.link) continue;
            const year = String(paper.year || '').trim();
            rows.push(
                buildRow({
                    id: `${code}:old_paper:${slugify(year) || rows.length}`,
                    subjectCode: code,
                    subjectName,
                    knownAs,
                    materialType: 'old_paper',
                    label: year || 'Old paper',
                    url: paper.link,
                    chatReady,
                    searchableText: `${subjectHaystack} ${year} old paper exam question paper`,
                })
            );
        }

        books.forEach((book, index) => {
            if (!book.download_link) return;
            const bookId = inferBookId(book, code, index);
            const title = book.title || book.alt_data?.trim() || bookId;
            rows.push(
                buildRow({
                    id: `${code}:book:${slugify(bookId)}`,
                    subjectCode: code,
                    subjectName,
                    knownAs,
                    materialType: 'book',
                    label: title,
                    url: book.download_link,
                    chatReady,
                    searchableText: `${subjectHaystack} ${title} book notes material`,
                })
            );
        });
    }

    return rows;
}

async function getCatalogIndex({ forceRefresh = false } = {}) {
    if (!cachedIndex || forceRefresh) {
        cachedIndex = await buildCatalogIndex();
    }
    return cachedIndex;
}

function extractSubjectCodeFromQuery(question) {
    const match = String(question || '').match(/\b(\d{7})\b/);
    return match ? match[1] : null;
}

function sliceAnchoredSubjectResults(scored, subjectCode, limit) {
    const anchored = scored.filter((item) => item.row.subjectCode === subjectCode);
    if (!anchored.length) {
        return null;
    }
    return anchored.slice(0, limit).map((item) => item.row);
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function haystackContainsToken(haystack, token) {
    if (!token) return false;
    const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
    if (pattern.test(haystack)) {
        return true;
    }

    if (token === 'maths' && /\bmathematics\b/i.test(haystack)) {
        return true;
    }

    return false;
}

function rowMatchesSubjectQuery(row, tokens, normalizedQuery) {
    const haystack = row.searchableText;

    if (tokens.some((token) => haystackContainsToken(haystack, token))) {
        return true;
    }

    const subjectCode = row.subjectCode.toLowerCase();
    if (normalizedQuery.includes(subjectCode)) {
        return true;
    }

    const knownAs = row.knownAs?.trim().toLowerCase();
    if (knownAs && haystackContainsToken(normalizedQuery, knownAs)) {
        return true;
    }

    return false;
}

function scoreRow(row, tokens, normalizedQuery) {
    if (!tokens.length) return 0;

    let score = 0;
    const haystack = row.searchableText;
    const hasSubjectMatch = rowMatchesSubjectQuery(row, tokens, normalizedQuery);

    for (const token of tokens) {
        if (haystackContainsToken(haystack, token)) score += 3;
    }

    if (row.subjectCode.toLowerCase() === normalizedQuery.replace(/\s+/g, '')) {
        score += 20;
    }

    if (normalizedQuery.includes(row.subjectCode.toLowerCase())) {
        score += 12;
    }

    if (hasSubjectMatch && /\bbook|notes|material\b/.test(normalizedQuery) && row.materialType === 'book') {
        score += 4;
    }
    if (hasSubjectMatch && /\bsyllabus\b/.test(normalizedQuery) && row.materialType === 'syllabus') {
        score += 6;
    }
    if (hasSubjectMatch && /\bpaper|exam\b/.test(normalizedQuery) && row.materialType === 'old_paper') {
        score += 5;
    }
    if (hasSubjectMatch && /\bsolution\b/.test(normalizedQuery) && row.materialType === 'paper_solution') {
        score += 5;
    }

    const seasonMatch = normalizedQuery.match(/\b(winter|summer)\b/);
    const yearMatch = normalizedQuery.match(/\b(20\d{2}|'\d{2}|\d{2})\b/);
    if (hasSubjectMatch && row.materialType === 'old_paper') {
        const label = row.label.toLowerCase();
        if (seasonMatch && label.includes(seasonMatch[1])) score += 8;
        if (yearMatch) {
            const yearText = yearMatch[1].replace("'", '');
            if (label.includes(yearText)) score += 8;
        }
    }

    if (hasSubjectMatch && normalizedQuery.includes(haystack) && haystack.length > 8) {
        score += 10;
    }

    return score;
}

async function broadSearchCatalogIndex(question, { limit = 50 } = {}) {
    const index = await getCatalogIndex();
    const normalizedQuery = String(question || '').toLowerCase().trim();
    const tokens = tokenize(normalizedQuery);
    const explicitSubjectCode = extractSubjectCodeFromQuery(question);

    const scored = index
        .map((row) => ({ row, score: scoreRow(row, tokens, normalizedQuery) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

    if (explicitSubjectCode) {
        const anchored = sliceAnchoredSubjectResults(scored, explicitSubjectCode, limit);
        if (anchored) {
            return anchored;
        }

        const subjectRows = index.filter((row) => row.subjectCode === explicitSubjectCode);
        if (subjectRows.length) {
            return subjectRows.slice(0, limit);
        }
    }

    if (scored.length === 0 && tokens.length > 0) {
        const fallback = index
            .map((row) => ({
                row,
                score: tokens.reduce(
                    (sum, token) =>
                        sum
                        + (row.searchableText.match(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi')) || [])
                            .length,
                    0
                ),
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score);

        if (explicitSubjectCode) {
            const anchored = sliceAnchoredSubjectResults(fallback, explicitSubjectCode, limit);
            if (anchored) {
                return anchored;
            }
        }

        return fallback.slice(0, limit).map((item) => item.row);
    }

    return scored.slice(0, limit).map((item) => item.row);
}

async function getCatalogRowsByIds(ids = []) {
    const index = await getCatalogIndex();
    const byId = new Map(index.map((row) => [row.id, row]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
}

function groupMatchesBySubject(rows = []) {
    const grouped = new Map();

    for (const row of rows) {
        if (!row.url && row.materialType !== 'subject') continue;
        const existing = grouped.get(row.subjectCode) || {
            subjectCode: row.subjectCode,
            subjectName: row.subjectName,
            knownAs: row.knownAs,
            chatReady: row.chatReady,
            items: [],
        };
        if (row.url) {
            existing.items.push({
                type: row.materialType,
                label: row.label,
                url: row.url,
            });
        }
        grouped.set(row.subjectCode, existing);
    }

    return [...grouped.values()];
}

function getCatalogGlobalSessionId() {
    return CATALOG_GLOBAL_SESSION_ID;
}

function clearCatalogIndexCache() {
    cachedIndex = null;
}

export {
    broadSearchCatalogIndex,
    buildCatalogIndex,
    clearCatalogIndexCache,
    extractSubjectCodeFromQuery,
    getCatalogGlobalSessionId,
    getCatalogIndex,
    getCatalogRowsByIds,
    groupMatchesBySubject,
    rowMatchesSubjectQuery,
    tokenize,
};
