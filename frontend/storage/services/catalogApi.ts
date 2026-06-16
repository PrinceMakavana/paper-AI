import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../axiosBaseQuery";
import type { SubjectDetail, SubjectSummary } from "@/lib/types";

interface SubjectsResponse {
  subjects?: SubjectSummary[];
  message?: string;
}

interface SubjectResponse {
  subject?: SubjectDetail;
  message?: string;
}

interface CatalogBookPdfUrlResponse {
  url?: string;
  message?: string;
}

export const catalogApi = createApi({
  reducerPath: "catalogApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Catalog"],
  endpoints: (builder) => ({
    getSubjects: builder.query<SubjectSummary[], void>({
      query: () => ({ url: "/catalog/subjects", method: "GET" }),
      transformResponse: (response: SubjectsResponse) => response.subjects ?? [],
      providesTags: ["Catalog"],
    }),
    getSubject: builder.query<SubjectDetail, string>({
      query: (subjectCode) => ({
        url: `/catalog/subjects/${encodeURIComponent(subjectCode)}`,
        method: "GET",
      }),
      transformResponse: (response: SubjectResponse) => {
        if (!response.subject) {
          throw new Error(response.message || "Failed to load subject");
        }
        return response.subject;
      },
      providesTags: (_result, _error, subjectCode) => [
        { type: "Catalog", id: subjectCode },
      ],
    }),
    getCatalogBookPdfUrl: builder.query<
      string,
      { subjectCode: string; bookId: string }
    >({
      query: ({ subjectCode, bookId }) => ({
        url: `/catalog/subjects/${encodeURIComponent(subjectCode)}/books/${encodeURIComponent(bookId)}/pdf-url`,
        method: "GET",
      }),
      transformResponse: (response: CatalogBookPdfUrlResponse) => {
        if (!response.url) {
          throw new Error(response.message || "Failed to open PDF");
        }
        return response.url;
      },
    }),
  }),
});

export const {
  useGetSubjectsQuery,
  useGetSubjectQuery,
  useLazyGetSubjectQuery,
  useLazyGetCatalogBookPdfUrlQuery,
} = catalogApi;
