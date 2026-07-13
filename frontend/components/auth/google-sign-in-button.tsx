"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleOAuth } from "@react-oauth/google";

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => void;
  onError: () => void;
  disabled?: boolean;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  disabled = false,
}: GoogleSignInButtonProps) {
  const { clientId, scriptLoadedSuccessfully } = useGoogleOAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      setButtonWidth(Math.floor(node.getBoundingClientRect().width));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scriptLoadedSuccessfully || !clientId || !googleButtonRef.current || buttonWidth <= 0) {
      return;
    }

    const google = window.google;
    if (!google?.accounts?.id) {
      return;
    }

    google.accounts.id.initialize({
      client_id: clientId,
      callback: (credentialResponse) => {
        if (credentialResponse?.credential) {
          onSuccessRef.current(credentialResponse.credential);
          return;
        }
        onErrorRef.current();
      },
    });

    googleButtonRef.current.innerHTML = "";

    google.accounts.id.renderButton(googleButtonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: buttonWidth,
    });

    setReady(true);
  }, [buttonWidth, clientId, scriptLoadedSuccessfully]);

  if (!clientId) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative h-10 w-full">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center gap-3 rounded-md border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition-colors dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </div>

      <div
        ref={googleButtonRef}
        className={`absolute inset-0 z-10 overflow-hidden opacity-[0.01] ${disabled || !ready ? "pointer-events-none" : ""}`}
        aria-label="Continue with Google"
      />
    </div>
  );
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number>
          ) => void;
        };
      };
    };
  }
}
