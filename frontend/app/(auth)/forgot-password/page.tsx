'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/components/context/alert/alert-context';
import { useForgotPasswordMutation } from '@/storage/services/authApi';
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, Mail } from 'lucide-react';

const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_COOLDOWN_STORAGE_KEY = 'paperai_reset_password_cooldown_until';

const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
});

type ApiErrorData = {
    error?: string;
    message?: string;
    code?: string;
    token?: string;
    retryAfterSeconds?: number;
};

function getApiError(err: unknown) {
    return err as { status?: number; data?: ApiErrorData };
}

export default function ForgotPasswordPage() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState<{ email?: string }>({});
    const [submitted, setSubmitted] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);

    const isSubmitDisabled = isLoading || cooldownSeconds > 0;

    const startCooldown = (seconds: number) => {
        const clamped = Math.max(1, Math.ceil(seconds));
        setCooldownSeconds(clamped);
        sessionStorage.setItem(
            RESEND_COOLDOWN_STORAGE_KEY,
            String(Date.now() + clamped * 1000)
        );
    };

    useEffect(() => {
        const storedCooldownUntil = sessionStorage.getItem(RESEND_COOLDOWN_STORAGE_KEY);
        if (!storedCooldownUntil) {
            return;
        }

        const remainingSeconds = Math.ceil((Number(storedCooldownUntil) - Date.now()) / 1000);
        if (remainingSeconds > 0) {
            setCooldownSeconds(remainingSeconds);
        } else {
            sessionStorage.removeItem(RESEND_COOLDOWN_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        if (cooldownSeconds <= 0) {
            sessionStorage.removeItem(RESEND_COOLDOWN_STORAGE_KEY);
            return;
        }

        const timerId = window.setTimeout(() => {
            setCooldownSeconds((current) => Math.max(0, current - 1));
        }, 1000);

        return () => window.clearTimeout(timerId);
    }, [cooldownSeconds]);

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const result = forgotPasswordSchema.safeParse({ email });
        if (!result.success) {
            const fieldErrors = result.error.flatten().fieldErrors;
            setErrors({ email: fieldErrors.email?.[0] });
            return;
        }

        try {
            const data = await forgotPassword({
                email: result.data.email.toLowerCase().trim(),
            }).unwrap();

            startCooldown(RESEND_COOLDOWN_SECONDS);

            if (data.token) {
                router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
                return;
            }

            setSubmitted(true);
            showAlert(
                data.message || 'If an account exists, check your email for a reset link.',
                'success'
            );
        } catch (err) {
            const error = getApiError(err);
            if (error.status === 429) {
                startCooldown(error.data?.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
                showAlert(
                    error.data?.error || 'Please wait before requesting another reset email.',
                    'error'
                );
                return;
            }
            showAlert(error.data?.error || error.data?.message || 'Something went wrong', 'error');
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="w-full max-w-md space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl text-center">
                        <div className="flex flex-col items-center gap-4">
                            <CheckCircle2 className="h-12 w-12 text-green-500" />
                            <h1 className="text-2xl font-bold">Check your email</h1>
                            <p className="text-sm text-muted-foreground">
                                If an account exists for {email}, we sent a password reset link.
                                The link expires in 15 minutes.
                            </p>
                            <Link
                                href="/login"
                                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center hover:opacity-90 transition-all"
                            >
                                Back to login
                            </Link>
                            <button
                                type="button"
                                onClick={() => setSubmitted(false)}
                                disabled={isSubmitDisabled}
                                className="text-sm text-muted-foreground hover:text-primary disabled:opacity-50"
                            >
                                {cooldownSeconds > 0
                                    ? `Resend in ${cooldownSeconds}s`
                                    : 'Send another link'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-6">
                <Link
                    href="/login"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                </Link>

                <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                            <LockKeyhole className="h-7 w-7 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold">Forgot Password?</h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            Enter your email and we&apos;ll send you a recovery link.
                        </p>
                    </div>

                    <form onSubmit={handleRequest} className="space-y-4">
                        <div className="space-y-1">
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    required
                                />
                            </div>
                            {errors.email && (
                                <p className="text-xs text-red-500 font-medium">{errors.email}</p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitDisabled}
                            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : cooldownSeconds > 0 ? (
                                `Resend in ${cooldownSeconds}s`
                            ) : (
                                'Send Reset Link'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
