"use client";

/**
 * Auth context: login, logout, registration, and current user state.
 * Exposes auth actions and loading flags for the app.
 */

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type PropsWithChildren,
} from "react";
import { useRouter } from "next/navigation";
import { clearAllCookies, clearLocalStorage, getCookie } from "@/lib/utils";
import {
  type AuthUser,
  useLoginMutation,
  useRegisterMutation,
  useLogoutUserMutation,
  useGetMeQuery,
  useUpdateProfileMutation,
} from "@/storage/services/authApi";
import { resetAllApiState } from "@/storage/store";
import { useAlert } from "../alert/alert-context";
import { COOKIE_STORAGE_KEYS } from "@/lib/constant";

/**
 * Shape of the auth context: loading flags, user, and auth actions.
 */
interface AuthContextType {
  isLoginLoading: boolean;
  isUserLoggedIn: boolean;
  isRegisterLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<void>;
  register: (registerRequest: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: (callAPI?: boolean) => Promise<void>;
  updateProfile: (profileRequest: {
    name?: string;
    email?: string;
  }) => Promise<AuthUser>;
  user: AuthUser | null | undefined;
  clearAuthStore: () => void;
  refreshUser: () => Promise<void>;
}

/** React context instance for auth; undefined when used outside AuthProvider. */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Wraps the app (or auth subtree) and provides login, logout, register, and user state.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [loginMutation, { isLoading: isLoginLoading }] = useLoginMutation();
  const [registerMutation, { isLoading: isRegisterLoading }] =
    useRegisterMutation();
  const [updateProfileMutation] = useUpdateProfileMutation();
  const [logoutUser] = useLogoutUserMutation();
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const hasAccessToken =
    typeof window !== "undefined" &&
    Boolean(getCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN));

  const { refetch, data: profileResponse } = useGetMeQuery(undefined, {
    skip: !hasAccessToken,
  });
  const user = profileResponse?.user;

  /**
   * Clears cookies, localStorage, and API state; optionally navigates to "/" and refreshes.
   * Used on logout and when auth/session is invalid (e.g. 401).
   * @param shouldNavigate - If true, navigates to "/" and calls router.refresh() after reset.
   */
  const clearAuthStore = useCallback(async (shouldNavigate: boolean = true) => {
    clearAllCookies();
    clearLocalStorage();
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
    setIsUserLoggedIn(false);

    if (shouldNavigate) {
      router.replace("/chat");
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    await resetAllApiState();

    if (shouldNavigate) {
      router.refresh();
    }
  }, [router]);

  /**
   * Refetches current user from API. On 401/404, clears auth store (cookies, state, navigation).
   */
  const refetchUser = useCallback(async () => {
    try {
      await refetch().unwrap();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 404) {
        clearAuthStore();
      }
    }
  }, [clearAuthStore, refetch]);

  /**
   * Syncs login state: refetches user when access token exists but user is missing; sets logged-in when user is loaded.
   */
  useEffect(() => {
    const token = getCookie(COOKIE_STORAGE_KEYS.ACCESS_TOKEN);
    if (token && !user) {
      refetchUser();
    }
    setIsUserLoggedIn(Boolean(token && user));
  }, [user, refetchUser]);

  /**
   * Logs in with email/password or with a refresh token (remember-me flow).
   * On success shows alert and navigates to OTP verify; on error shows error alert and rethrows.
   * @param refresh_token - Optional; when provided, uses remember-me login instead of password.
   */
  const login = async (
    email: string,
    password: string,
  ) => {
    try {
      const result = await loginMutation({
        email,
        password,
      }).unwrap();
      showAlert(
        result?.message || "Login successful",
        "success"
      );
      setIsUserLoggedIn(true);
      router.replace("/chat");
      router.refresh();
    } catch (err: unknown) {
      const error = err as { data?: { error?: string; message?: string }; message?: string };
      showAlert(
        error?.data?.error || error?.data?.message || error?.message || "Login failed",
        "error"
      );
      throw err;
    }
  };

  /**
   * Logs out: optionally calls logout API, then always clears auth store (cookies, state, navigation).
   * @param callAPI - If true, calls logout endpoint before clearing store; default true.
   */
  const logout = async (callAPI: boolean = false) => {
    try {
      if (callAPI) {
        const response = await logoutUser("").unwrap();
        showAlert(
          response?.message || "Sign out successful",
          "success"
        );
      }
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      await clearAuthStore();
    }
  };

  /**
   * Registers a new user with the given request payload.
   * Shows success alert and returns API result on success; returns error object on failure.
   */
  const register = async (registerRequest: {
    name: string;
    email: string;
    password: string;
  }) => {
    try {
      const result = await registerMutation(registerRequest).unwrap();
      showAlert(result?.message || "Account created successfully!", "success");
      setIsUserLoggedIn(true);
      router.replace("/");
      router.refresh();
    } catch (err: unknown) {
      const error = err as { data?: { error?: string; message?: string }; message?: string };
      showAlert(
        error?.data?.error ||
          error?.data?.message ||
          error?.message ||
          "Registration failed",
        "error"
      );
      throw err;
    }
  };

  const updateProfile = async (profileRequest: {
    name?: string;
    email?: string;
  }) => {
    const result = await updateProfileMutation(profileRequest).unwrap();
    return result.user;
  };


  const value: AuthContextType = {
    isLoginLoading,
    isUserLoggedIn,
    isRegisterLoading,
    login,
    register,
    logout,
    updateProfile,
    user,
    clearAuthStore,
    refreshUser: refetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context (login, logout, user, loading flags).
 * Must be used inside AuthProvider; throws otherwise.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
