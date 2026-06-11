"use client";

import { ThemeProvider } from "@/components/context/theme/theme-provider";
import { AlertProvider } from "./context/alert/alert-context";
import { AuthProvider } from "./context/auth/auth-context";
import { ReduxProvider } from "@/storage/provider";
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
        <AuthProvider>{children}</AuthProvider>
      </AlertProvider>
      </ReduxProvider>
    </ThemeProvider>
  );
}
