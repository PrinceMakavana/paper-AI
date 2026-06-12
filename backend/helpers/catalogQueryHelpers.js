function getCatalogContributeFormUrl() {
    return String(process.env.CATALOG_CONTRIBUTE_FORM_URL || '').trim();
}

function parseFindMaterialConstraints(question) {
    const q = String(question || '').toLowerCase();
    const season = /\bwinter\b/.test(q) ? 'winter' : /\bsummer\b/.test(q) ? 'summer' : null;

    let year = null;
    const fourDigit = q.match(/\b(20\d{2}|19\d{2})\b/);
    if (fourDigit) {
        year = fourDigit[1];
    } else {
        const twoDigit = q.match(/\b'?(\d{2})\b/);
        if (twoDigit) {
            const n = parseInt(twoDigit[1], 10);
            year = n <= 30 ? `20${twoDigit[1].padStart(2, '0')}` : `19${twoDigit[1].padStart(2, '0')}`;
        }
    }

    const wantsPaper = /\b(paper|papers|exam|question\s*paper|old\s*paper)\b/.test(q);
    const wantsBook = /\b(book|books|notes|material)\b/.test(q);
    const wantsSyllabus = /\bsyllabus\b/.test(q);
    const hasSpecificPaperRequest = wantsPaper && Boolean(season || year);

    return {
        season,
        year,
        wantsPaper,
        wantsBook,
        wantsSyllabus,
        hasSpecificPaperRequest,
    };
}

function paperLabelMatchesConstraints(label, constraints) {
    if (!constraints?.season && !constraints?.year) return true;

    const normalized = String(label || '').toLowerCase().replace(/[_\s]/g, '-');
    if (constraints.season && !normalized.includes(constraints.season)) {
        return false;
    }

    if (constraints.year) {
        const fullYear = constraints.year;
        const shortYear = fullYear.slice(-2);
        if (!normalized.includes(fullYear) && !normalized.includes(shortYear)) {
            return false;
        }
    }

    return true;
}

function validateSelectedRowsForQuestion(selectedRows, constraints) {
    if (!selectedRows.length) return [];

    if (constraints.hasSpecificPaperRequest) {
        return selectedRows.filter(
            (row) =>
                row.materialType === 'old_paper' &&
                paperLabelMatchesConstraints(row.label, constraints)
        );
    }

    if (constraints.wantsSyllabus) {
        return selectedRows.filter((row) => row.materialType === 'syllabus');
    }

    if (constraints.wantsBook) {
        return selectedRows.filter((row) => row.materialType === 'book');
    }

    return selectedRows;
}

function buildDataNotAvailableAnswer({ question, constraints } = {}) {
    const formUrl = getCatalogContributeFormUrl();
    const contributeLine = formUrl
        ? `You can [contribute this material here](${formUrl}) to help other students.`
        : '';

    let detail = ' We could not find this in our catalog yet.';
    if (constraints?.hasSpecificPaperRequest) {
        const parts = [];
        if (constraints.season) parts.push(constraints.season);
        if (constraints.year) parts.push(constraints.year);
        detail = ` We do not have the **${parts.join(' ')}** exam paper in our catalog yet.`;
    } else if (constraints?.wantsSyllabus) {
        detail = ' We do not have a syllabus link for this request yet.';
    } else if (constraints?.wantsBook) {
        detail = ' We do not have book material for this request yet.';
    } else if (question) {
        detail = ' We could not find matching material for your request yet.';
    }

    const lines = [
        '**Data is not available right now.**',
        detail.trim(),
        'We will try to add it in the future.',
    ];

    if (contributeLine) {
        lines.push(contributeLine);
    }

    return lines.join('\n\n');
}

export {
    buildDataNotAvailableAnswer,
    getCatalogContributeFormUrl,
    paperLabelMatchesConstraints,
    parseFindMaterialConstraints,
    validateSelectedRowsForQuestion,
};
