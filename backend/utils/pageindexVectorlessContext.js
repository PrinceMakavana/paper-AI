function normalizeWords(q) {
    const words = String(q || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    return new Set(words.filter((word) => word.length > 2));
}

function expandQuestionForRetrieval(question) {
    const q = String(question || '').toLowerCase();
    const extras = [];

    if (/\bdefin(ing|ition|e)\b/.test(q)) {
        extras.push('writing definitions descriptions');
    }
    if (/creative\s*respell/i.test(q)) {
        extras.push('word formation prefixes suffixes spelling abbreviations note-taking');
    }
    if (/style of writing/i.test(q)) {
        extras.push('technical writing characteristics paragraph style');
    }
    if (/correct\s+(the\s+)?verb|verb\s+form/i.test(q)) {
        extras.push('tenses verb agreement patterns');
    }
    if (/synonym|antonym/i.test(q)) {
        extras.push('words meanings vocabulary');
    }

    return extras.length ? `${question} ${extras.join(' ')}` : question;
}

function scoreTextAgainstQuestion(question, text) {
    const words = normalizeWords(question);
    if (words.size === 0) return 0;

    const lower = String(text || '').toLowerCase();
    let score = 0;
    for (const word of words) {
        if (lower.includes(word)) score += 1;
    }
    return score;
}

function nodeBlob(node) {
    return [node.title, node.summary || '', node.text].join('\n');
}

function walkNodes(nodes, out) {
    if (!nodes?.length) return;
    for (const node of nodes) {
        out.push(node);
        walkNodes(node.nodes, out);
    }
}

function truncateToBudget(text, maxChars) {
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n...[truncated]`;
}

function formatNodeBlock(node, bookMeta) {
    const prefix = bookMeta
        ? `[Book: ${bookMeta.title} | book_id: ${bookMeta.bookId}]\n`
        : '';
    return `${prefix}## ${node.title}\n${node.summary ? `Summary: ${node.summary}\n` : ''}${node.text}\n`;
}

function buildContextFromScoredNodes(scored, question, maxChars) {
    const parts = [];
    let len = 0;
    const pagesByBook = new Map();

    for (const { node, bookMeta } of scored) {
        const block = formatNodeBlock(node, bookMeta);
        if (len + block.length > maxChars) {
            const remaining = maxChars - len;
            if (remaining > 120) {
                parts.push(block.slice(0, remaining));
                if (Number.isFinite(node.page_index) && bookMeta?.bookId) {
                    const pages = pagesByBook.get(bookMeta.bookId) || new Set();
                    pages.add(node.page_index);
                    pagesByBook.set(bookMeta.bookId, pages);
                }
            }
            break;
        }
        parts.push(block);
        len += block.length;
        if (Number.isFinite(node.page_index) && bookMeta?.bookId) {
            const pages = pagesByBook.get(bookMeta.bookId) || new Set();
            pages.add(node.page_index);
            pagesByBook.set(bookMeta.bookId, pages);
        }
    }

    const pagesInContext = [];
    for (const [bookId, pages] of pagesByBook.entries()) {
        for (const page of [...pages].sort((a, b) => a - b)) {
            pagesInContext.push({ bookId, page });
        }
    }

    return {
        context: parts.join('\n'),
        pagesInContext,
    };
}

function buildContextFromTree(roots, question, maxChars) {
    const flat = [];
    walkNodes(roots, flat);
    const retrievalQuery = expandQuestionForRetrieval(question);

    const scored = flat
        .map((node, index) => ({
            node,
            bookMeta: null,
            score: scoreTextAgainstQuestion(retrievalQuery, nodeBlob(node)),
            index,
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);

    const { context, pagesInContext } = buildContextFromScoredNodes(scored, question, maxChars);

    return {
        context,
        pagesInContext: pagesInContext.map((item) => item.page).sort((a, b) => a - b),
        topRetrievalScore: scored.length ? scored[0].score : 0,
    };
}

function buildContextFromMultipleTrees(bookTrees, question, maxChars) {
    const flat = [];
    const retrievalQuery = expandQuestionForRetrieval(question);

    for (const { bookId, title, roots } of bookTrees) {
        const bookMeta = { bookId, title };
        const nodes = [];
        walkNodes(roots, nodes);
        for (const node of nodes) {
            flat.push({ node, bookMeta });
        }
    }

    const scored = flat
        .map((entry, index) => ({
            ...entry,
            score: scoreTextAgainstQuestion(
                retrievalQuery,
                `[${entry.bookMeta.title}]\n${nodeBlob(entry.node)}`
            ),
            index,
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);

    const result = buildContextFromScoredNodes(scored, question, maxChars);
    return {
        ...result,
        topRetrievalScore: scored.length ? scored[0].score : 0,
    };
}

function pickTopPagesForFetchByBook(bookTrees, question, maxPages) {
    const flat = [];
    const retrievalQuery = expandQuestionForRetrieval(question);

    for (const { bookId, title, roots, pdfStoragePath } of bookTrees) {
        const nodes = [];
        walkNodes(roots, nodes);
        for (const node of nodes) {
            flat.push({ node, bookId, title, pdfStoragePath });
        }
    }

    const scored = flat
        .map((entry, index) => ({
            ...entry,
            score: scoreTextAgainstQuestion(
                retrievalQuery,
                `[${entry.title}]\n${nodeBlob(entry.node)}`
            ),
            index,
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);

    const seen = new Set();
    const out = [];

    for (const { node, bookId, pdfStoragePath } of scored) {
        const page = node.page_index;
        const key = `${bookId}:${page}`;
        if (!Number.isFinite(page) || !bookId || !pdfStoragePath || seen.has(key)) continue;
        seen.add(key);
        out.push({ bookId, page, pdfStoragePath });
        if (out.length >= maxPages) break;
    }

    return out;
}

function pickTopPagesForFetch(roots, question, maxPages) {
    const flat = [];
    walkNodes(roots, flat);
    const retrievalQuery = expandQuestionForRetrieval(question);

    const scored = flat
        .map((node, index) => ({
            node,
            score: scoreTextAgainstQuestion(retrievalQuery, nodeBlob(node)),
            index,
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index);

    const seen = new Set();
    const out = [];

    for (const { node } of scored) {
        const page = node.page_index;
        if (!Number.isFinite(page) || seen.has(page)) continue;
        seen.add(page);
        out.push(page);
        if (out.length >= maxPages) break;
    }

    if (out.length === 0) {
        for (const node of flat) {
            const page = node.page_index;
            if (!Number.isFinite(page) || seen.has(page)) continue;
            seen.add(page);
            out.push(page);
            if (out.length >= maxPages) break;
        }
    }

    return out.sort((a, b) => a - b);
}

function formatPagesArg(pages) {
    if (pages.length === 0) return '1';
    return pages.join(',');
}

export {
    buildContextFromMultipleTrees,
    buildContextFromTree,
    expandQuestionForRetrieval,
    formatPagesArg,
    pickTopPagesForFetch,
    pickTopPagesForFetchByBook,
    truncateToBudget,
};
