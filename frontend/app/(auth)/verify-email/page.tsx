'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/components/context/alert/alert-context';
import { useResendVerificationMutation, useVerifyEmailMutation } from '@/storage/services/authApi';
import { ArrowLeft, CheckCircle2, Loader2, Mail, XCircle } from 'lucide-react';

const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_COOLDOWN_STORAGE_KEY = 'paperai_verify_email_cooldown_until';

type ApiErrorData = {
    error?: string;
    message?: string;
    code?: string;
    redirect?: string;
    retryAfterSeconds?: number;
};

function getApiError(err: unknown) {
    return err as { status?: number; data?: ApiErrorData };
}

function VerifyEmailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showAlert } = useAlert();
    const token = searchParams.get('token');
    const emailParam = searchParams.get('email') || '';

    const [email, setEmail] = useState(emailParam);
    const [verifyEmail, { isLoading: verifying }] = useVerifyEmailMutation();
    const [resendVerification, { isLoading: resending }] = useResendVerificationMutation();
    const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [verifyMessage, setVerifyMessage] = useState('');
    const [cooldownSeconds, setCooldownSeconds] = useState(0);

    const startCooldown = (seconds: number) => {
        const clamped = Math.max(1, Math.ceil(seconds));
        setCooldownSeconds(clamped);
        sessionStorage.setItem(
            RESEND_COOLDOWN_STORAGE_KEY,
            String(Date.now() + clamped * 1000)
        );
    };

    const isResendDisabled = resending || cooldownSeconds > 0;

    const handleApiRedirect = (data?: ApiErrorData, fallbackMessage?: string) => {
        const message = data?.error || data?.message || fallbackMessage;
        if (message) {
            showAlert(message, data?.code === 'EMAIL_SENT' || data?.code === 'EMAIL_VERIFIED' ? 'success' : 'error');
        }

        if (data?.redirect) {
            router.replace(data.redirect);
            return true;
        }

        if (data?.code === 'EMAIL_ALREADY_VERIFIED') {
            router.replace('/login');
            return true;
        }

        if (data?.code === 'EMAIL_NOT_FOUND') {
            router.replace('/register');
            return true;
        }

        if (data?.code === 'EMAIL_SENT' || data?.code === 'EMAIL_VERIFIED') {
            router.replace('/login');
            return true;
        }

        return false;
    };

    useEffect(() => {
        setEmail(emailParam);
    }, [emailParam]);

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

    useEffect(() => {
        if (!token) {
            return;
        }

        const runVerification = async () => {
            try {
                const result = await verifyEmail({ token }).unwrap();
                setVerifyStatus('success');
                setVerifyMessage(result.message || 'Email verified successfully.');
                showAlert(result.message || 'Email verified successfully.', 'success');
                router.replace(result.redirect || '/login');
            } catch (err) {
                const error = getApiError(err);
                if (handleApiRedirect(error.data, 'Verification link is invalid or has expired.')) {
                    return;
                }
                setVerifyStatus('error');
                setVerifyMessage(
                    error.data?.error ||
                        error.data?.message ||
                        'Verification link is invalid or has expired.'
                );
            }
        };

        runVerification();
    }, [token, verifyEmail, router, showAlert]);

    const handleResend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isResendDisabled) {
            return;
        }

        if (!email.trim()) {
            showAlert('Please enter your email address.', 'error');
            return;
        }

        try {
            const result = await resendVerification({ email: email.toLowerCase().trim() }).unwrap();
            startCooldown(RESEND_COOLDOWN_SECONDS);
            showAlert(result.message || 'Verification email sent.', 'success');
            router.replace(result.redirect || '/login');
        } catch (err) {
            const error = getApiError(err);
            if (error.status === 429) {
                startCooldown(error.data?.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
                return;
            }
            if (handleApiRedirect(error.data)) {
                return;
            }
            showAlert(error.data?.error || error.data?.message || 'Could not resend email.', 'error');
        }
    };

    if (token) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="w-full max-w-md space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl text-center">
                        {verifying && (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-muted-foreground">Verifying your email...</p>
                            </div>
                        )}

                        {!verifying && verifyStatus === 'success' && (
                            <div className="flex flex-col items-center gap-4">
                                <CheckCircle2 className="h-12 w-12 text-green-500" />
                                <h1 className="text-2xl font-bold">Email verified</h1>
                                <p className="text-sm text-muted-foreground">{verifyMessage}</p>
                                <Link
                                    href="/login"
                                    className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center hover:opacity-90 transition-all"
                                >
                                    Continue to login
                                </Link>
                            </div>
                        )}

                        {!verifying && verifyStatus === 'error' && (
                            <div className="flex flex-col items-center gap-4">
                                <XCircle className="h-12 w-12 text-destructive" />
                                <h1 className="text-2xl font-bold">Verification failed</h1>
                                <p className="text-sm text-muted-foreground">{verifyMessage}</p>
                                <Link
                                    href={emailParam ? `/verify-email?email=${encodeURIComponent(emailParam)}` : '/verify-email'}
                                    className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center hover:opacity-90 transition-all"
                                >
                                    Resend verification email
                                </Link>
                                <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
                                    Back to login
                                </Link>
                            </div>
                        )}
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
                            <Mail className="h-7 w-7 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold">Verify your email</h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            {emailParam
                                ? `We sent a verification link to ${emailParam}. Check your inbox and spam folder.`
                                : 'Enter your email to resend the verification link.'}
                        </p>
                    </div>

                    <form onSubmit={handleResend} className="space-y-4">
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
                        <button
                            type="submit"
                            disabled={isResendDisabled}
                            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50"
                        >
                            {resending ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : cooldownSeconds > 0 ? (
                                `Resend in ${cooldownSeconds}s`
                            ) : (
                                'Resend verification email'
                            )}
                        </button>
                        <Link
                            href="/login"
                            className="w-full h-12 border border-border rounded-xl font-bold flex items-center justify-center hover:bg-muted transition-all"
                        >
                            Login
                        </Link>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <VerifyEmailContent />
        </Suspense>
    );
}
