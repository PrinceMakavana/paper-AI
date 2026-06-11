import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type {
  AxiosRequestConfig,
  AxiosError,
  Method,
  AxiosResponse,
} from "axios";
import { decryptData, encryptData } from "@/lib/encryption";
import axios from "axios";
import { LANGUAGE_CODE, LOCAL_STORAGE_KEYS } from "@/lib/constant";
export interface APIPARAMETER {
  url: string;
  method: Method;
  params?: AxiosRequestConfig["params"];
  data?: unknown;
  headers?: unknown;
  file?: unknown;
  contentType?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || ""; // Empty string for relative URLs
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION;
const IS_ENCRYPTION = process.env.NEXT_PUBLIC_IS_ENCRYPTION === "1";

export const axiosBaseQuery =
  (): BaseQueryFn<APIPARAMETER, unknown, unknown> =>
  async ({ url, method, data, headers, contentType }) => {
    try {
      const requestData = IS_ENCRYPTION ? await encryptData(data) : data;
      const ApiUrl = API_URL + (API_VERSION ? `${API_VERSION}` : "") + url;
      const result: AxiosResponse<unknown> = await axios({
        url: ApiUrl,
        method: method,
        headers: {
          ...(headers as unknown as Record<string, string>),
          "Content-Type": contentType || "application/json",
          "X-Language":
            localStorage.getItem(LOCAL_STORAGE_KEYS.LANGUAGE) ||
            LANGUAGE_CODE.ENGLISH,
          "Access-Control-Allow-Origin": "*",
          'ngrok-skip-browser-warning': 'true',
          ...(IS_ENCRYPTION && { "x-encrypted": "true" }),
        },
        data: requestData,
        timeout: 120000,
      });
      if (result?.data) {
        const responseData = IS_ENCRYPTION
          ? await decryptData(result.data as string)
          : result.data;
        return { data: responseData };
      }
      return { data: "" };
    } catch (error) {
      const err = error as AxiosError;
      return {
        error: {
          status: err.response?.status,
          data: err.response?.data || err.message,
        },
      };
    }
  };
