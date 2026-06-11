import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery, type APIPARAMETER } from "../axiosBaseQuery";
import {
  clearAllCookies,
  clearLocalStorage,
  getToken,
  setCookie,
  setLocalStorage,
} from "@/lib/utils";
import { COOKIE_STORAGE_KEYS, LOCAL_STORAGE_KEYS } from "@/lib/constant";
interface LoginRequest {
  email: string;
  password: string;
}
interface RegisterRequest extends LoginRequest {
  name: string;
}
export interface AuthUser {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role?: string;
  isEmailVerified?: boolean;
  available_token_count?: number;
  available_page_count?: number;
}
export interface AuthResponse {
  message?: string;
  user: AuthUser;
  token: string;
}
export interface RegisterResponse {
  message?: string;
  email: string;
}
export interface MessageResponse {
  message?: string;
  code?: string;
  redirect?: string;
  token?: string;
  retryAfterSeconds?: number;
}
export interface ProfileResponse {
  message?: string;
  user: AuthUser;
}
interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

const persistAuthSession = (response: AuthResponse) => {
  if (!response?.token || !response?.user) {
    return;
  }

  setCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN, response.token);
  setLocalStorage(LOCAL_STORAGE_KEYS.USER, response.user);
  setLocalStorage(LOCAL_STORAGE_KEYS.EMAIL, response.user.email);
  setCookie(COOKIE_STORAGE_KEYS.EMAIL, response.user.email);
};

function isEmailNotVerifiedError(error?: { status?: number; data?: unknown }) {
  if (!error || error.status !== 403) {
    return false;
  }
  const data = error.data as { code?: string } | undefined;
  return data?.code === "EMAIL_NOT_VERIFIED";
}

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ['User'],
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => {
        return {
          url: "/users/login",
          method: "POST",
          data: credentials,
        };
      },
      transformResponse: (response: AuthResponse) => {
        persistAuthSession(response);
        return response;
      },
      invalidatesTags: ['User'],
    }),
    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (payload) => {
        return {
          url: "/users/register",
          method: "POST",
          data: payload,
        };
      },
      invalidatesTags: ['User'],
    }),
    verifyEmail: builder.mutation<MessageResponse, { token: string }>({
      query: (payload) => ({
        url: "/verify-email",
        method: "POST",
        data: payload,
      }),
    }),
    resendVerification: builder.mutation<MessageResponse, { email: string }>({
      query: (payload) => ({
        url: "/resend-verification",
        method: "POST",
        data: payload,
      }),
    }),
    forgotPassword: builder.mutation<MessageResponse, { email: string }>({
      query: (payload) => ({
        url: "/forgot-password",
        method: "POST",
        data: payload,
      }),
    }),
    resetPassword: builder.mutation<MessageResponse, { token: string; newPassword: string }>({
      query: (payload) => ({
        url: "/reset-password",
        method: "POST",
        data: payload,
      }),
    }),
    logoutUser: builder.mutation<AuthResponse, unknown>({
      query: () => {
        return {
          url: "/logout",
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        };
      },
    }),
    getMe: builder.query<ProfileResponse | null, void>({
      queryFn: async (_arg, _api, _extraOptions, baseQuery) => {
        const Token = getToken();
        if (!Token) {
          return { data: null };
        }
        const typedBaseQuery = baseQuery as (
          arg: APIPARAMETER
        ) => Promise<{
          data?: ProfileResponse;
          error?: { status?: number; data?: unknown };
        }>;
        const result = await typedBaseQuery({
          url: "/users/profile",
          method: "GET",
          headers: {
            Authorization: `Bearer ${Token}`,
            'Access-Control-Allow-Origin': '*',
          },
        });
        if (result.error) {
          const status = result.error.status;
          if (status === 401 || status === 404 || isEmailNotVerifiedError(result.error)) {
            clearAllCookies();
            clearLocalStorage();
          }
          return { error: result.error };
        }
        return { data: result.data };
      },
      providesTags: ['User'],
    }),
    updateProfile: builder.mutation<ProfileResponse, UpdateProfileRequest>({
      query: (payload) => {
        return {
          url: "/users/profile",
          method: "PUT",
          data: payload,
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        };
      },
      async onQueryStarted(_payload, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(
          authApi.util.updateQueryData("getMe", undefined, (draft) => {
            if (draft) {
              draft.user = data.user;
            }
          })
        );
        setLocalStorage(LOCAL_STORAGE_KEYS.USER, data.user);
        setLocalStorage(LOCAL_STORAGE_KEYS.EMAIL, data.user.email);
        setCookie(COOKIE_STORAGE_KEYS.EMAIL, data.user.email);
      },
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useLogoutUserMutation,
  useGetMeQuery,
  useUpdateProfileMutation,
} = authApi;
