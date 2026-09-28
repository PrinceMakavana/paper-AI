"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/auth/TurnstileWidget";
import { isTurnstileConfigured } from "@/lib/turnstile";

const STORAGE_KEY = "paperai_turnstile_verified_at";
const VERIFICATION_TTL_MS = 5 * 60 * 1000;

const CRAWLER_UA =
  /\b(googlebot|googleother|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex(bot|images)|applebot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|ccbot|bytespider|amazonbot|facebookexternalhit|twitterbot|linkedinbot)\b/i;

function isCrawlerUserAgent() {
  if (typeof navigator === "undefined") return false;
  return CRAWLER_UA.test(navigator.userAgent || "");
}

type TurnstileGateProps = {
  children: ReactNode;
  title?: string;
  description?: string;
};

export function TurnstileGate({
  children,
  title = "Verify to continue",
  description = "Complete this quick check to view GTU subject materials.",
}: TurnstileGateProps) {
  const [verified, setVerified] = useState(false);
  const [ready, setReady] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  useEffect(() => {
    if (!isTurnstileConfigured() || isCrawlerUserAgent()) {
      setVerified(true);
      setReady(true);
      return;
    }

    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const verifiedAt = Number(stored);
      if (Number.isFinite(verifiedAt) && Date.now() - verifiedAt < VERIFICATION_TTL_MS) {
        setVerified(true);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }

    setReady(true);
  }, []);

  const handleVerify = () => {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVerified(true);
  };

  const handleReset = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setVerified(false);
    turnstileRef.current?.reset();
  };

  if (!ready) {
    return null;
  }

  if (verified) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex justify-center">
        <TurnstileWidget
          ref={turnstileRef}
          onVerify={handleVerify}
          onExpire={handleReset}
          onError={handleReset}
        />
      </div>
    </div>
  );
}
