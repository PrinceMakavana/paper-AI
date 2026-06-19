import { COOKIE_STORAGE_KEYS, LOCAL_STORAGE_KEYS } from "@/lib/constants";
import { clearSessionStorage, setCookie, setLocalStorage } from "@/lib/utils";

export type AdminUser = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role?: string;
  isAdmin?: true;
  isEmailVerified?: boolean;
  available_token_count?: number;
  available_page_count?: number;
};

type LoginResponse = {
  message?: string;
  token?: string;
  user?: AdminUser;
  error?: string;
};

export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

function getApiBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new AdminAuthError("Admin API is not configured.");
  }

  const apiVersion = process.env.NEXT_PUBLIC_API_VERSION ?? "";
  return `${apiUrl.replace(/\/$/, "")}${apiVersion}`;
}

export async function loginAdmin(email: string, password: string) {
  const response = await fetch(`${getApiBaseUrl()}/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = (await response.json().catch(() => ({}))) as LoginResponse;

  if (!response.ok) {
    throw new AdminAuthError(data.error || data.message || "Login failed.");
  }

  if (!data.token || !data.user) {
    throw new AdminAuthError("Login response is missing session data.");
  }

  if (data.user.isAdmin !== true) {
    clearSessionStorage();
    throw new AdminAuthError("Admin access required.");
  }

  setCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN, data.token);
  setLocalStorage(LOCAL_STORAGE_KEYS.USER, data.user);
  setLocalStorage(LOCAL_STORAGE_KEYS.EMAIL, data.user.email);

  return data;
}

export function logoutAdmin() {
  clearSessionStorage();
}
