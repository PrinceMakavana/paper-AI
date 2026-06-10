'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { Input } from "@/components/ui/input";
import { useAlert } from '@/components/context/alert/alert-context';
import { Loader2, Mail, ArrowLeft, LockKeyhole } from "lucide-react";
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const router = useRouter(); // Initialize router
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const { showAlert } = useAlert();

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

        try {
            const res = await fetch(`${BACKEND_API_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 
                    'Access-Control-Allow-Origin': '*',
                    'ngrok-skip-browser-warning': 'true',
                },
                body: JSON.stringify({ email: email.toLowerCase().trim() }),
            });

            const data = await res.json();

            if (res.ok) {
                showAlert("Development Mode: Redirecting to reset page...", "success");
                
                if (data.token) {
                    router.push(`/reset-password?token=${data.token}`);
                } else {
                    showAlert("Reset link sent if account exists", "success");
                }
            } else {
                showAlert(data.error || "Something went wrong", "error");
            }
        } catch (err) {
            showAlert("Network error", "error");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-6">
                <Link href="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Login
                </Link>

                <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                            <LockKeyhole className="h-7 w-7 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold">Forgot Password?</h1>
                        <p className="text-sm text-muted-foreground mt-2">Enter your email for a recovery link.</p>
                    </div>

                    <form onSubmit={handleRequest} className="space-y-4">
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
                            disabled={loading}
                            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}