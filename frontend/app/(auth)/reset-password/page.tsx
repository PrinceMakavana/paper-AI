'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { useAlert } from '@/components/context/alert/alert-context';
import { Loader2, Lock } from "lucide-react";

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { showAlert } = useAlert();

    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return showAlert("Invalid or missing token", "error");

        setLoading(true);
        try {
            const res = await fetch(`${BACKEND_API_URL}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 
                    'Access-Control-Allow-Origin': '*',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({ token, newPassword: password }),
            });

            if (res.ok) {
                showAlert("Password reset successfully!", "success");
                router.push('/login');
            } else {
                const data = await res.json();
                showAlert(data.error || "Reset failed", "error");
            }
        } catch (err) {
            showAlert("Network error", "error");
            console.error(err)
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl">
                <h1 className="text-2xl font-bold text-center mb-6">Create New Password</h1>
                <form onSubmit={handleReset} className="space-y-4">
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="password"
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}