import mongoose from 'mongoose';
import CatalogSubject from '../models/catalogSubjectModel.js';

function ensureMongoConnected() {
    if (mongoose.connection.readyState !== 1) {
        const error = new Error('MongoDB is not connected');
        error.statusCode = 503;
        throw error;
    }
}

function normalizeSubjectRecord(doc) {
    if (!doc) return null;

    const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    const code = String(plain.subjecet_code || plain.subject_code || '').trim();
    const books = plain.Books ?? plain.books ?? [];

    return {
        ...plain,
        subjecet_code: code,
        subject_code: plain.subject_code || code,
        Books: books,
        books,
    };
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
        (book) => book.pageindex_status === 'ready' && book.pageindex_s3_uri
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

async function loadAllCatalogSubjects() {
    ensureMongoConnected();

    const docs = await CatalogSubject.find({})
        .sort({ subjecet_code: 1, subject_code: 1 })
        .lean();

    return docs.map(normalizeSubjectRecord).filter(Boolean);
}

async function loadSubjectByCode(subjectCode) {
    ensureMongoConnected();

    const trimmed = String(subjectCode).trim();
    const doc = await CatalogSubject.findOne({
        $or: [{ subjecet_code: trimmed }, { subject_code: trimmed }],
    }).lean();

    if (!doc) {
        const error = new Error(`Subject not found: ${subjectCode}`);
        error.statusCode = 404;
        throw error;
    }

    const subject = normalizeSubjectRecord(doc);
    const code = String(subject.subjecet_code || subjectCode).trim();

    if (code !== trimmed) {
        const error = new Error(
            `Subject code mismatch for ${subjectCode} (expected ${subjectCode}, found ${code})`
        );
        error.statusCode = 500;
        throw error;
    }

    return { subject, subjectCode: code };
}

function getReadyBooks(subject) {
    const subjectCode = String(subject.subjecet_code || subject.subject_code || '').trim();
    return (subject.Books || [])
        .map((book, index) => ({
            ...book,
            book_id: inferBookId(book, subjectCode, index),
            title: book.title || book.alt_data?.trim() || inferBookId(book, subjectCode, index),
        }))
        .filter((book) => book.pageindex_status === 'ready' && book.pageindex_s3_uri);
}

async function listSubjects() {
    const subjects = await loadAllCatalogSubjects();

    return subjects.map((subject) => {
        const subjectCode = String(subject.subjecet_code || subject.subject_code || '').trim();
        return mapSubjectSummary(subject, subjectCode);
    });
}

async function getSubject(subjectCode) {
    const { subject, subjectCode: code } = await loadSubjectByCode(subjectCode);
    return mapSubjectDetail(subject, code);
}

function getSubjectChatSessionId(subjectCode) {
    return `subject:${String(subjectCode).trim()}`;
}

async function findBookInSubject(subjectCode, bookId) {
    const detail = await getSubject(subjectCode);
    const book = detail.books.find((item) => item.bookId === bookId);
    if (!book) {
        const error = new Error(`Book not found: ${bookId}`);
        error.statusCode = 404;
        throw error;
    }
    return { subject: detail, book };
}

export {
    loadAllCatalogSubjects,
    listSubjects,
    getSubject,
    getReadyBooks,
    loadSubjectByCode,
    getSubjectChatSessionId,
    findBookInSubject,
    mapBookForClient,
    normalizeSubjectRecord,
};
