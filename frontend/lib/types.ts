export interface DocumentMetaData {
    id : string;
    filename: string;
    uploadedAt : Date;
    summary : string;
    pageCount: number;
    fileSize:number;
    indexStatus?: string | null;
    tokenCount?: number;
    pdfS3Uri?: string;
    pageindexS3Uri?: string;
    storageStatus?: string;
}

export type PageindexStatus = "ready" | "partial" | "pending" | "failed";

export interface CatalogBook {
    bookId: string;
    title?: string;
    img?: string;
    altData?: string;
    downloadLink?: string;
    pageindexStatus?: "ready" | "pending" | "failed";
    pageindexSizeBytes?: number;
    pageindexS3Uri?: string;
    pdfStoragePath?: string;
    pdfS3Uri?: string;
    tokenCount?: number;
    indexedAt?: string;
    indexVersion?: number;
}

export interface SubjectSummary {
    subjectCode: string;
    subjectName: string;
    knownAs?: string;
    pageindexStatus?: PageindexStatus;
    indexedBookCount?: number;
    bookCount?: number;
    chatMode?: string;
}

export interface SubjectDetail extends SubjectSummary {
    primaryBookId?: string;
    syllabus?: string;
    paperSolution?: string;
    oldPaper?: { year: string; link: string }[];
    books: CatalogBook[];
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content : string;
    timestamp: Date | string;
    documentId: string;
    subjectCode?: string;
}

export interface TokenBalanceResponse {
    available_token_count?: number;
}
