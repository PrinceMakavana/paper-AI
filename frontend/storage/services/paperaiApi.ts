import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../axiosBaseQuery";
import { PAPERAI_API_PREFIX } from "@/lib/constant";
import type {
  AskQuestionRequest,
  ChatContext,
  ChatMessagesResponse,
  DocumentStatusResponse,
  DocumentsResponse,
  PdfUrlResponse,
  QuestionResponse,
  UploadResponse,
} from "../types/paperai";
import type { ChatMessage, DocumentMetaData } from "@/lib/types";

function chatMessagesUrl(context: ChatContext): string {
  switch (context.type) {
    case "document":
      return `${PAPERAI_API_PREFIX}/chat-messages/${encodeURIComponent(context.documentId)}`;
    case "subject":
      return `${PAPERAI_API_PREFIX}/chat-messages/subject/${encodeURIComponent(context.subjectCode)}`;
    case "catalog":
      return `${PAPERAI_API_PREFIX}/chat-messages/catalog/global`;
  }
}

function askQuestionUrl(context: ChatContext): string {
  switch (context.type) {
    case "document":
      return `${PAPERAI_API_PREFIX}/question-vectorless-rag`;
    case "subject":
      return `${PAPERAI_API_PREFIX}/subject-question-rag`;
    case "catalog":
      return `${PAPERAI_API_PREFIX}/catalog-find`;
  }
}

function askQuestionBody({ context, question, chatModel }: AskQuestionRequest) {
  switch (context.type) {
    case "document":
      return { question, documentId: context.documentId, chatModel };
    case "subject":
      return { question, subjectCode: context.subjectCode, chatModel };
    case "catalog":
      return { question, chatModel };
  }
}

function chatTag(context: ChatContext) {
  switch (context.type) {
    case "document":
      return { type: "ChatMessages" as const, id: `doc:${context.documentId}` };
    case "subject":
      return { type: "ChatMessages" as const, id: `subject:${context.subjectCode}` };
    case "catalog":
      return { type: "ChatMessages" as const, id: "catalog:global" };
  }
}

export const paperaiApi = createApi({
  reducerPath: "paperaiApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Documents", "ChatMessages"],
  endpoints: (builder) => ({
    getDocuments: builder.query<DocumentMetaData[], void>({
      query: () => ({ url: `${PAPERAI_API_PREFIX}/documents`, method: "GET" }),
      transformResponse: (response: DocumentsResponse) => response.documents ?? [],
      providesTags: (result) =>
        result
          ? [
              ...result.map((doc) => ({ type: "Documents" as const, id: doc.id })),
              { type: "Documents", id: "LIST" },
            ]
          : [{ type: "Documents", id: "LIST" }],
    }),
    getDocumentStatus: builder.query<DocumentStatusResponse, string>({
      query: (documentId) => ({
        url: `${PAPERAI_API_PREFIX}/documents/${encodeURIComponent(documentId)}/status`,
        method: "GET",
      }),
    }),
    getDocumentPdfUrl: builder.query<PdfUrlResponse, string>({
      query: (documentId) => ({
        url: `${PAPERAI_API_PREFIX}/documents/${encodeURIComponent(documentId)}/pdf-url`,
        method: "GET",
      }),
    }),
    uploadDocument: builder.mutation<
      UploadResponse,
      { file: File; modelProvider: string }
    >({
      query: ({ file, modelProvider }) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("model_provider", modelProvider);
        return {
          url: `${PAPERAI_API_PREFIX}/upload`,
          method: "POST",
          data: formData,
        };
      },
      invalidatesTags: [{ type: "Documents", id: "LIST" }],
    }),
    deleteDocument: builder.mutation<{ status: number; message?: string }, string>({
      query: (documentId) => ({
        url: `${PAPERAI_API_PREFIX}/documents/${encodeURIComponent(documentId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, documentId) => [
        { type: "Documents", id: documentId },
        { type: "Documents", id: "LIST" },
      ],
    }),
    getChatMessages: builder.query<ChatMessage[], ChatContext>({
      query: (context) => ({
        url: chatMessagesUrl(context),
        method: "GET",
      }),
      transformResponse: (response: ChatMessagesResponse) => response.messages ?? [],
      providesTags: (_result, _error, context) => [chatTag(context)],
    }),
    deleteChatMessages: builder.mutation<{ status: number; message?: string }, ChatContext>({
      query: (context) => ({
        url: chatMessagesUrl(context),
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, context) => [chatTag(context)],
    }),
    askQuestion: builder.mutation<QuestionResponse, AskQuestionRequest>({
      query: (payload) => ({
        url: askQuestionUrl(payload.context),
        method: "POST",
        data: askQuestionBody(payload),
      }),
      invalidatesTags: (_result, _error, { context }) => [chatTag(context)],
    }),
  }),
});

export const {
  useGetDocumentsQuery,
  useGetDocumentStatusQuery,
  useLazyGetDocumentStatusQuery,
  useGetDocumentPdfUrlQuery,
  useLazyGetDocumentPdfUrlQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
  useGetChatMessagesQuery,
  useDeleteChatMessagesMutation,
  useAskQuestionMutation,
} = paperaiApi;
