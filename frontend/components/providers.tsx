"use client";

import { ThemeProvider } from "@/components/context/theme/theme-provider";
import { AlertProvider } from "./context/alert/alert-context";
import { AuthProvider } from "./context/auth/auth-context";
import { ReduxProvider } from "@/storage/provider";
import { GoogleOAuthProvider } from "@react-oauth/google";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ReduxProvider>
      <AlertProvider>
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthProvider>{children}</AuthProvider>
        </GoogleOAuthProvider>
      </AlertProvider>
      </ReduxProvider>
    </ThemeProvider>
  );
}
