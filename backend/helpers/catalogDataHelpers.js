const fs = require('fs');
const path = require('path');

function getCatalogDataDir() {
    const configured = process.env.CATALOG_DATA_DIR;
    if (configured) {
        return path.isAbsolute(configured)
            ? configured
            : path.resolve(__dirname, '..', configured);
    }
    return path.resolve(__dirname, '..', '..', 'data');
}

function readSubjectFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function inferBookId(book, subjectCode, index) {
    if (book.book_id) return String(book.book_id);
    return `${subjectCode}-${index}`;
}

function mapBookForClient(book, subjectCode, index) {
    const bookId = inferBookId(book, subjectCode, index);
    return {
        bookId,
        title: book.title || book.alt_data?.trim() || bookId,
        img: book.img,
        altData: book.alt_data,
        downloadLink: book.download_link,
        pageindexStatus: book.pageindex_status || 'pending',
        pageindexSizeBytes: book.pageindex_size_bytes,
        pageindexStoragePath: book.pageindex_storage_path,
        pageindexS3Uri: book.pageindex_s3_uri,
        pdfStoragePath: book.pdf_storage_path,
        pdfS3Uri: book.pdf_s3_uri,
        tokenCount: book.token_count,
        indexedAt: book.indexed_at,
        indexVersion: book.index_version,
    };
}

function countReadyBooks(books = []) {
    return books.filter(
        (book) => book.pageindex_status === 'ready' && book.pageindex_storage_path
    ).length;
}

function resolveSubjectPageindexStatus(subject, readyCount, bookCount) {
    if (subject.pageindex_status) return subject.pageindex_status;
    if (readyCount === 0) return 'pending';
    if (readyCount >= bookCount) return 'ready';
    return 'partial';
}

function mapSubjectSummary(subject, subjectCode) {
    const books = subject.Books || [];
    const readyCount = subject.indexed_book_count ?? countReadyBooks(books);
    const bookCount = books.length;

    return {
        subjectCode,
        subjectName: subject.subject_name,
        knownAs: subject.known_as,
        pageindexStatus: resolveSubjectPageindexStatus(subject, readyCount, bookCount),
        indexedBookCount: readyCount,
        bookCount,
        chatMode: subject.chat_mode || 'subject',
    };
}

function mapSubjectDetail(subject, subjectCode) {
    const books = subject.Books || [];
    const summary = mapSubjectSummary(subject, subjectCode);

    return {
        ...summary,
        primaryBookId: subject.primary_book_id,
        syllabus: subject.syllabus,
        paperSolution: subject.paper_solution,
        oldPaper: (subject.old_paper || []).map((item) => ({
            year: item.year,
            link: item.link,
        })),
        books: books.map((book, index) => mapBookForClient(book, subjectCode, index)),
    };
}

function loadSubjectByCode(subjectCode) {
    const dir = getCatalogDataDir();
    const filePath = path.join(dir, `${subjectCode}.json`);

    if (!fs.existsSync(filePath)) {
        const error = new Error(`Subject not found: ${subjectCode}`);
        error.statusCode = 404;
        throw error;
    }

    const subject = readSubjectFile(filePath);
    const code = String(subject.subjecet_code || subjectCode).trim();

    if (code !== String(subjectCode).trim()) {
        const error = new Error(
            `Subject code mismatch in ${subjectCode}.json (expected ${subjectCode}, found ${code})`
        );
        error.statusCode = 500;
        throw error;
    }

    return { subject, subjectCode: code };
}

function getReadyBooks(subject) {
    const subjectCode = String(subject.subjecet_code || '').trim();
    return (subject.Books || [])
        .map((book, index) => ({
            ...book,
            book_id: inferBookId(book, subjectCode, index),
            title: book.title || book.alt_data?.trim() || inferBookId(book, subjectCode, index),
        }))
        .filter((book) => book.pageindex_status === 'ready' && book.pageindex_storage_path);
}

function listSubjects() {
    const dir = getCatalogDataDir();
    if (!fs.existsSync(dir)) {
        return [];
    }

    const files = fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .sort();

    return files.map((filename) => {
        const subjectCode = filename.replace(/\.json$/, '');
        const subject = readSubjectFile(path.join(dir, filename));
        return mapSubjectSummary(subject, subjectCode);
    });
}

function getSubject(subjectCode) {
    const { subject, subjectCode: code } = loadSubjectByCode(subjectCode);
    return mapSubjectDetail(subject, code);
}

function getSubjectChatSessionId(subjectCode) {
    return `subject:${String(subjectCode).trim()}`;
}

function findBookInSubject(subjectCode, bookId) {
    const detail = getSubject(subjectCode);
    const book = detail.books.find((item) => item.bookId === bookId);
    if (!book) {
        const error = new Error(`Book not found: ${bookId}`);
        error.statusCode = 404;
        throw error;
    }
    return { subject: detail, book };
}

module.exports = {
    getCatalogDataDir,
    listSubjects,
    getSubject,
    getReadyBooks,
    loadSubjectByCode,
    getSubjectChatSessionId,
    findBookInSubject,
    mapBookForClient,
};
