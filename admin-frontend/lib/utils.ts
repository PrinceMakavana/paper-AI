import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function setCookie(name: string, value: string, days = 30) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/;SameSite=Lax`;
}

export function getCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieName = `${name}=`;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const trimmedCookie = cookie.trim();
    if (trimmedCookie.startsWith(cookieName)) {
      return trimmedCookie.slice(cookieName.length);
    }
  }

  return null;
}

export function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

export function setLocalStorage(name: string, value: string | object | null) {
  if (typeof window === "undefined" || value == null) {
    return;
  }

  localStorage.setItem(name, typeof value === "string" ? value : JSON.stringify(value));
}

export function getLocalStorage<T>(name: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(name);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

export function clearSessionStorage() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.clear();
  deleteCookie("accessToken");
}
