import fs from 'node:fs';
import path from 'node:path';
import { getCatalogDataDir } from './catalogDataHelpers.js';

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

function buildCatalogIndex() {
    const dir = getCatalogDataDir();
    if (!fs.existsSync(dir)) {
        return [];
    }

    const rows = [];
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();

    for (const filename of files) {
        const subjectCode = filename.replace(/\.json$/, '');
        let subject;
        try {
            subject = JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
        } catch {
            continue;
        }

        const code = String(subject.subjecet_code || subjectCode).trim();
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

        if (subject.syllabus) {
            rows.push(
                buildRow({
                    id: `${code}:syllabus:main`,
                    subjectCode: code,
                    subjectName,
                    knownAs,
                    materialType: 'syllabus',
                    label: 'Syllabus',
                    url: subject.syllabus,
                    chatReady,
                    searchableText: `${subjectHaystack} syllabus`,
                })
            );
        }

        if (subject.paper_solution) {
            rows.push(
                buildRow({
                    id: `${code}:paper_solution:main`,
                    subjectCode: code,
                    subjectName,
                    knownAs,
                    materialType: 'paper_solution',
                    label: 'Paper solutions',
                    url: subject.paper_solution,
                    chatReady,
                    searchableText: `${subjectHaystack} paper solution solutions`,
                })
            );
        }

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

function getCatalogIndex({ forceRefresh = false } = {}) {
    if (!cachedIndex || forceRefresh) {
        cachedIndex = buildCatalogIndex();
    }
    return cachedIndex;
}

function scoreRow(row, tokens, normalizedQuery) {
    if (!tokens.length) return 0;

    let score = 0;
    const haystack = row.searchableText;

    for (const token of tokens) {
        if (haystack.includes(token)) score += 3;
    }

    if (row.subjectCode.toLowerCase() === normalizedQuery.replace(/\s+/g, '')) {
        score += 20;
    }

    if (normalizedQuery.includes(row.subjectCode.toLowerCase())) {
        score += 12;
    }

    if (/\bbook|notes|material\b/.test(normalizedQuery) && row.materialType === 'book') {
        score += 4;
    }
    if (/\bsyllabus\b/.test(normalizedQuery) && row.materialType === 'syllabus') {
        score += 6;
    }
    if (/\bpaper|exam\b/.test(normalizedQuery) && row.materialType === 'old_paper') {
        score += 5;
    }
    if (/\bsolution\b/.test(normalizedQuery) && row.materialType === 'paper_solution') {
        score += 5;
    }

    const seasonMatch = normalizedQuery.match(/\b(winter|summer)\b/);
    const yearMatch = normalizedQuery.match(/\b(20\d{2}|'\d{2}|\d{2})\b/);
    if (row.materialType === 'old_paper') {
        const label = row.label.toLowerCase();
        if (seasonMatch && label.includes(seasonMatch[1])) score += 8;
        if (yearMatch) {
            const yearText = yearMatch[1].replace("'", '');
            if (label.includes(yearText)) score += 8;
        }
    }

    if (normalizedQuery.includes(haystack) && haystack.length > 8) {
        score += 10;
    }

    return score;
}

function broadSearchCatalogIndex(question, { limit = 50 } = {}) {
    const index = getCatalogIndex();
    const normalizedQuery = String(question || '').toLowerCase().trim();
    const tokens = tokenize(normalizedQuery);

    const scored = index
        .map((row) => ({ row, score: scoreRow(row, tokens, normalizedQuery) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

    if (scored.length === 0 && tokens.length > 0) {
        const fallback = index
            .map((row) => ({
                row,
                score: tokens.reduce(
                    (sum, token) => sum + (row.searchableText.split(token).length - 1),
                    0
                ),
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score);
        return fallback.slice(0, limit).map((item) => item.row);
    }

    return scored.slice(0, limit).map((item) => item.row);
}

function getCatalogRowsByIds(ids = []) {
    const index = getCatalogIndex();
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
    getCatalogGlobalSessionId,
    getCatalogIndex,
    getCatalogRowsByIds,
    groupMatchesBySubject,
    tokenize,
};
