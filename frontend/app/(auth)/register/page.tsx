'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { useAuth } from '@/components/context/auth/auth-context';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/auth/TurnstileWidget';
import { isTurnstileConfigured } from '@/lib/turnstile';
import freeEmailDomains from "free-email-domains";
import { getSafeInternalPath } from '@/lib/landing-links';

 const isCompanyEmail = (value?: string) => {
    if (!value) {
      return true;
    }

    const domain = value.split("@")[1]?.toLowerCase();
    if (!domain) {
      return true;
    }

    if (domain === "gmail.com") {
      return true;
    }
    return !freeEmailDomains.includes(domain);
  };


const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address").refine(
    (email) => isCompanyEmail(email),
    {
      message: "Please use a company email address or Google Workspace email",
    }
  ),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function RegisterPage() {

  
  const router = useRouter();
  const { register, loginWithGoogle, isRegisterLoading, isGoogleLoginLoading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loginHref, setLoginHref] = useState('/login');
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; server?: string }>({});

  useEffect(() => {
    const next = getSafeInternalPath(new URLSearchParams(window.location.search).get('next'));
    setLoginHref(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  }, []);

  const resetTurnstile = () => {
    setTurnstileToken('');
    turnstileRef.current?.reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    if (isTurnstileConfigured() && !turnstileToken) {
      setErrors({ server: 'Please complete the verification check.' });
      return;
    }

    try {
      await register({
        ...formData,
        turnstileToken: turnstileToken || undefined,
      });
    } catch (err) {
      resetTurnstile();
      const error = err as { data?: { error?: string; message?: string }; message?: string };
      setErrors({
        server:
          error?.data?.error ||
          error?.data?.message ||
          error?.message ||
          "Server connection failed",
      });
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    setErrors({});
    try {
      await loginWithGoogle(idToken);
    } catch (err) {
      const error = err as { data?: { error?: string; message?: string }; message?: string };
      setErrors({
        server:
          error?.data?.error ||
          error?.data?.message ||
          error?.message ||
          "Google sign-in failed. Please try again.",
      });
    }
  };

  const handleGoogleError = () => {
    setErrors({ server: "Google sign-in was cancelled or failed. Please try again." });
  };

  const isAuthLoading = isRegisterLoading || isGoogleLoginLoading;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Create Account
          </h1>
        </div>

        <div className="p-6 bg-white dark:bg-primary-foreground shadow-xl rounded-xl border border-zinc-200 dark:border-zinc-800">
          {errors.server && (
            <div className="mb-4 flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <p>{errors.server}</p>
            </div>
          )}
          <GoogleSignInButton
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            disabled={isAuthLoading}
          />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-primary-foreground px-2 text-zinc-500">or</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="name">
                Full Name
              </label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg:transparent"
              />
              {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="email">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg:transparent"
              />
              {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="bg:transparent"
              />
              {errors.password && <p className="text-xs text-red-500 font-medium">{errors.password}</p>}
            </div>

            <TurnstileWidget
              ref={turnstileRef}
              onVerify={setTurnstileToken}
              onExpire={resetTurnstile}
              onError={resetTurnstile}
            />

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 h-10 px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
            >
              {isRegisterLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRegisterLoading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-zinc-500">
            Already have an account?{" "}
            <button
              onClick={() => router.push(loginHref)}
              className="font-medium text-blue-500 hover:underline underline-offset-4"
            >
              Log in
            </button>
          </div>
        </div>

        <p className="px-8 text-center text-xs text-zinc-500 leading-relaxed">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
