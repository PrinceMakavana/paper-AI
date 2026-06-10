'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { useAuth } from '@/components/context/auth/auth-context';
import freeEmailDomains from "free-email-domains";

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
  const { register, isRegisterLoading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; server?: string }>({});

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

    try {
      await register(formData);
    } catch (err) {
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

            <button
              type="submit"
              disabled={isRegisterLoading}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 h-10 px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
            >
              {isRegisterLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRegisterLoading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-zinc-500">
            Already have an account?{" "}
            <button
              onClick={() => router.push('/login')}
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
