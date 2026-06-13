import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PDFDocument } from "pdf-lib";
import { COOKIE_STORAGE_KEYS , LOCAL_STORAGE_KEYS } from "./constant";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ChatModelType = "gemini" | "ollama";



export async function validateFile(file: File) {
    // File must be a PDF
    // File Page Count must be less than 100
    // Max File Size is 10MB
    if (file.type !== "application/pdf") {
        return { success: false, message: "File must be a PDF" };
    }
    const maxFilePageCount = process.env.NEXT_PUBLIC_MAX_FILE_PAGE_COUNT || 10;
    const maxFileSize = process.env.NEXT_PUBLIC_MAX_FILE_SIZE || 10; //in mb
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
    const pageCount = pdfDoc.getPageCount();
    if (pageCount > Number(maxFilePageCount)) {
        return { success: false, message: `PDF exceeds the maximum allowed length (${maxFilePageCount})` };
    }
    if (file.size > Number(maxFileSize) * 1024 * 1024) { //convert mb to bytes
        return { success: false, message: `File size has be less than ${maxFileSize} MB` };
    }
    return { success: true, pageCount };
}

export const setCookie = (name: string, value: string, days: number = 30) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
};

export const getCookie = (name: string): string | null => {
  const cookieName = `${name}=`;
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.indexOf(cookieName) === 0) {
      return cookie.substring(cookieName.length, cookie.length);
    }
  }
  return null;
};

export const deleteCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

// make same function for set and get local storage
export const setLocalStorage = (name: string, value: string | object | null) => {
  if (value == undefined || typeof window === 'undefined') {
    return;
  }
  if (typeof value === 'string') {
    localStorage.setItem(name, value);
    return;
  }
  localStorage.setItem(name, JSON.stringify(value));
};

export const getLocalStorage = (name: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  const value = localStorage.getItem(name);
  if (value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.log("=> Error parsing local storage", name, error);
      return value;
    }
  }
  return null;
};
export const deleteLocalStorage = (name: string) => {
  localStorage.removeItem(name);
};

export const clearLocalStorage = () => {
  // get last saved language preference
  const lastLanguage = getLocalStorage(LOCAL_STORAGE_KEYS.LANGUAGE);
  localStorage.clear();
  // restore last saved language preference
  if (lastLanguage) {
    setLocalStorage(LOCAL_STORAGE_KEYS.LANGUAGE, lastLanguage);
  }
};

export const clearAllCookies = (stricted = false) => {
  // check  is remember me cookie is set to true Do not delete // refresh token , email  , remember me
  if (stricted) {
    document.cookie.split(';').forEach(function (c) { document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/'); });
    return;
  }
  const rememberMe = getCookie(COOKIE_STORAGE_KEYS.REMEMBER_ME);
  if (rememberMe === "true") {
    // delete auth token from cookies
    deleteCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN);
    return;
  } else {
    document.cookie.split(';').forEach(function (c) { document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/'); });
  }
};

export const getToken = () => {
  return getCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN);
};

export const getRandomId = (length: number = 10) => {
  return Math.random().toString(36).substring(2, 2 + length);
};
