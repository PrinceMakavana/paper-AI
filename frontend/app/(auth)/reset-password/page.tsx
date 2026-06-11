'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/components/context/alert/alert-context';
import { useResetPasswordMutation } from '@/storage/services/authApi';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, XCircle } from 'lucide-react';

const resetPasswordSchema = z
    .object({
        password: z.string().min(6, 'Password must be at least 6 characters'),
        confirmPassword: z.string().min(6, 'Please confirm your password'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

type ApiErrorData = {
    error?: string;
    message?: string;
    code?: string;
    redirect?: string;
};

function getApiError(err: unknown) {
    return err as { status?: number; data?: ApiErrorData };
}

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { showAlert } = useAlert();
    const [resetPassword, { isLoading }] = useResetPasswordMutation();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        if (!token) {
            showAlert('Invalid or missing reset link.', 'error');
            return;
        }

        const result = resetPasswordSchema.safeParse({ password, confirmPassword });
        if (!result.success) {
            const fieldErrors = result.error.flatten().fieldErrors;
            setErrors({
                password: fieldErrors.password?.[0],
                confirmPassword: fieldErrors.confirmPassword?.[0],
            });
            return;
        }

        try {
            const data = await resetPassword({
                token,
                newPassword: result.data.password,
            }).unwrap();

            showAlert(data.message || 'Password reset successfully!', 'success');
            router.replace(data.redirect || '/login');
        } catch (err) {
            const error = getApiError(err);
            showAlert(
                error.data?.error || error.data?.message || 'Reset failed',
                'error'
            );
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="w-full max-w-md space-y-6">
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl text-center">
                        <div className="flex flex-col items-center gap-4">
                            <XCircle className="h-12 w-12 text-destructive" />
                            <h1 className="text-2xl font-bold">Invalid reset link</h1>
                            <p className="text-sm text-muted-foreground">
                                This password reset link is missing or invalid. Request a new one.
                            </p>
                            <Link
                                href="/forgot-password"
                                className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center hover:opacity-90 transition-all"
                            >
                                Request reset link
                            </Link>
                            <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
                                Back to login
                            </Link>
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
                            <Lock className="h-7 w-7 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold">Create New Password</h1>
                        <p className="text-sm text-muted-foreground mt-2">
                            Choose a new password for your account.
                        </p>
                    </div>

                    <form onSubmit={handleReset} className="space-y-4">
                        <div className="space-y-1">
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="New password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="text-xs text-red-500 font-medium">{errors.password}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <p className="text-xs text-red-500 font-medium">{errors.confirmPassword}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                'Update Password'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <ResetPasswordContent />
        </Suspense>
    );
}
