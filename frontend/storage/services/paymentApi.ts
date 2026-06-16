import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../axiosBaseQuery";
import type { CreateOrderResponse } from "../types/paperai";

export const paymentApi = createApi({
  reducerPath: "paymentApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    createOrder: builder.mutation<CreateOrderResponse, { token_count: number }>({
      query: (payload) => ({
        url: "/payment/create-order",
        method: "POST",
        data: payload,
      }),
    }),
  }),
});

export const { useCreateOrderMutation } = paymentApi;
