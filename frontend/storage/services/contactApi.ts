import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../axiosBaseQuery";

export interface ContactFormRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  turnstileToken?: string;
}

export interface ContactFormResponse {
  message?: string;
  code?: string;
}

export const contactApi = createApi({
  reducerPath: "contactApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    submitContact: builder.mutation<ContactFormResponse, ContactFormRequest>({
      query: (payload) => ({
        url: "/contact",
        method: "POST",
        data: payload,
      }),
    }),
  }),
});

export const { useSubmitContactMutation } = contactApi;
