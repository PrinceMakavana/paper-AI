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
  useGoogleLoginMutation,
  useRegisterMutation,
  useLogoutUserMutation,
  useGetMeQuery,
  useUpdateProfileMutation,
} from "@/storage/services/authApi";
import { resetAllApiState } from "@/storage/store";
import { useAlert } from "../alert/alert-context";
import { COOKIE_STORAGE_KEYS } from "@/lib/constant";
import { getSafeInternalPath, ROUTES } from "@/lib/landing-links";

/**
 * Shape of the auth context: loading flags, user, and auth actions.
 */
interface AuthContextType {
  isLoginLoading: boolean;
  isGoogleLoginLoading: boolean;
  isUserLoggedIn: boolean;
  isRegisterLoading: boolean;
  login: (
    email: string,
    password: string,
    turnstileToken?: string,
  ) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (registerRequest: {
    name: string;
    email: string;
    password: string;
    turnstileToken?: string;
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

function getEmailNotVerifiedPayload(error: unknown) {
  const payload = error as {
    status?: number;
    data?: { code?: string; email?: string };
  };
  if (payload?.status === 403 && payload?.data?.code === "EMAIL_NOT_VERIFIED") {
    return payload.data;
  }
  return null;
}

/**
 * Wraps the app (or auth subtree) and provides login, logout, register, and user state.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [loginMutation, { isLoading: isLoginLoading }] = useLoginMutation();
  const [googleLoginMutation, { isLoading: isGoogleLoginLoading }] = useGoogleLoginMutation();
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

  const postAuthRedirect = useCallback(() => {
    const next =
      typeof window !== "undefined"
        ? getSafeInternalPath(new URLSearchParams(window.location.search).get("next"))
        : null;
    router.replace(next || ROUTES.chat);
    router.refresh();
  }, [router]);

  const redirectToVerifyEmail = useCallback(
    (emailAddress: string) => {
      clearAllCookies();
      clearLocalStorage();
      setIsUserLoggedIn(false);
      router.replace(`/verify-email?email=${encodeURIComponent(emailAddress)}`);
    },
    [router]
  );

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
      const notVerified = getEmailNotVerifiedPayload(err);
      if (notVerified) {
        redirectToVerifyEmail(notVerified.email || "");
        return;
      }

      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 404) {
        clearAuthStore();
      }
    }
  }, [clearAuthStore, redirectToVerifyEmail, refetch]);

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

  useEffect(() => {
    if (user && user.isEmailVerified === false) {
      redirectToVerifyEmail(user.email);
    }
  }, [user, redirectToVerifyEmail]);

  /**
   * Logs in with email/password.
   */
  const login = async (
    email: string,
    password: string,
    turnstileToken?: string,
  ) => {
    try {
      const result = await loginMutation({
        email,
        password,
        turnstileToken,
      }).unwrap();
      showAlert(
        result?.message || "Login successful",
        "success"
      );
      setIsUserLoggedIn(true);
      postAuthRedirect();
    } catch (err: unknown) {
      const notVerified = getEmailNotVerifiedPayload(err);
      if (notVerified) {
        showAlert("Please verify your email before logging in.", "success");
        redirectToVerifyEmail(notVerified.email || email);
        return;
      }

      const error = err as { data?: { error?: string; message?: string }; message?: string };
      showAlert(
        error?.data?.error || error?.data?.message || error?.message || "Login failed",
        "error"
      );
      throw err;
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    try {
      const result = await googleLoginMutation({ idToken }).unwrap();
      showAlert(result?.message || "Login successful", "success");
      setIsUserLoggedIn(true);
      postAuthRedirect();
    } catch (err: unknown) {
      const error = err as { data?: { error?: string; message?: string }; message?: string };
      showAlert(
        error?.data?.error || error?.data?.message || error?.message || "Google sign-in failed",
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
   */
  const register = async (registerRequest: {
    name: string;
    email: string;
    password: string;
    turnstileToken?: string;
  }) => {
    try {
      const result = await registerMutation(registerRequest).unwrap();
      showAlert(
        result?.message || "Account created. Please verify your email.",
        "success"
      );
      sessionStorage.setItem(
        "paperai_verify_email_cooldown_until",
        String(Date.now() + 60 * 1000)
      );
      router.replace(
        `/verify-email?email=${encodeURIComponent(registerRequest.email)}`
      );
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
    if (result.user.isEmailVerified === false) {
      showAlert(
        result.message || "Please verify your new email address.",
        "success"
      );
      redirectToVerifyEmail(result.user.email);
    }
    return result.user;
  };


  const value: AuthContextType = {
    isLoginLoading,
    isGoogleLoginLoading,
    isUserLoggedIn,
    isRegisterLoading,
    login,
    loginWithGoogle,
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
