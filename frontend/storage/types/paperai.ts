import type { ChatMessage, DocumentMetaData } from "@/lib/types";

export interface DocumentsResponse {
  status?: number;
  message?: string;
  documents?: DocumentMetaData[];
}

export interface DocumentStatusResponse {
  status: number;
  message?: string;
  documentId?: string;
  indexStatus?: string;
  document?: DocumentMetaData;
}

export interface PdfUrlResponse {
  status: number;
  url?: string;
  expiresIn?: number;
  message?: string;
}

export interface UploadResponse {
  status?: number;
  message?: string;
  documentId?: string;
  summary?: string;
  available_page_count?: number;
}

export interface CatalogMatchItem {
  type: string;
  label: string;
  url: string;
}

export interface CatalogMatchGroup {
  subjectCode: string;
  subjectName: string;
  knownAs?: string;
  chatReady?: boolean;
  items: CatalogMatchItem[];
}

export interface ChatMessagesResponse {
  status: number;
  message?: string;
  messages?: ChatMessage[];
}

export interface QuestionResponse {
  status: number;
  answer?: string;
  answer_source?: "book" | "not_in_book" | "catalog" | "local" | "ai";
  intent?: "find_material" | "study_question";
  matches?: CatalogMatchGroup[];
  suggestedSubjectCodes?: string[];
  paper_solution_url?: string | null;
  message?: ChatMessage | string;
  available_token_count?: number;
}

export interface CreateOrderResponse {
  amount: number;
  key_id: string;
  currency: string;
  notes?: Record<string, string>;
  order_id: string;
}

export interface CreateProductOrderResponse {
  amount: number;
  key_id: string;
  currency: string;
  notes?: Record<string, string>;
  order_id: string;
  product_slug: string;
  product_title: string;
}

export type ChatContext =
  | { type: "document"; documentId: string }
  | { type: "subject"; subjectCode: string }
  | { type: "catalog" };

export interface AskQuestionRequest {
  context: ChatContext;
  question: string;
  chatModel: string;
}
