'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { useAlert } from '@/components/context/alert/alert-context';
import { useAuth } from '@/components/context/auth/auth-context';
import {
    Loader2,
    User,
    Mail,
    ArrowLeft,
    Pencil,
    Check,
    X,
    UserCircle2,
    AlertCircle,
    Coins,
} from "lucide-react";

export default function ProfilePage() {
    const router = useRouter();
    const { showAlert } = useAlert();
    const { user: authUser, updateProfile , isUserLoggedIn } = useAuth();

    const [user, setUser] = useState({ name: '', email: '', availableTokenCount: 0, availablePageCount: 0 });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const [editField, setEditField] = useState<'name' | 'email' | null>(null);
    const [tempValue, setTempValue] = useState('');
    const [fieldError, setFieldError] = useState<string | null>(null);

    useEffect(() => {
        if (!isUserLoggedIn) {
            router.push('/login');
            return;
        }

        if (authUser) {
            setUser({
                name: authUser.name,
                email: authUser.email,
                availableTokenCount: Number(authUser.available_token_count ?? 0),
                availablePageCount: Number(authUser.available_page_count ?? 0),
            });
            setLoading(false);
        }
    }, [authUser, router, isUserLoggedIn]);

    const handleUpdate = async (field: 'name' | 'email') => {
        if (!tempValue.trim() || tempValue === user[field]) {
            setEditField(null);
            setFieldError(null);
            return;
        }

        setUpdating(true);
        setFieldError(null);

        try {
            const updatedUser = await updateProfile({ [field]: tempValue.trim() });
            setUser({
                name: updatedUser.name,
                email: updatedUser.email,
                availableTokenCount: Number(updatedUser.available_token_count ?? user.availableTokenCount),
                availablePageCount: Number(updatedUser.available_page_count ?? user.availablePageCount),
            });
            setEditField(null);
            showAlert(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`, "success");
        } catch (err) {
            const error = err as { data?: { error?: string; message?: string }; message?: string };
            setFieldError(
                error?.data?.error ||
                error?.data?.message ||
                error?.message ||
                "Network connection error"
            );
        } finally {
            setUpdating(false);
        }
    };

    const startEditing = (field: 'name' | 'email', currentVal: string) => {
        setEditField(field);
        setTempValue(currentVal);
        setFieldError(null);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-6">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full opacity-30 pointer-events-none">
                <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-20%] w-[60%] h-[60%] rounded-full bg-ring/10 blur-[120px]" />
            </div>

            <div className="w-full max-w-lg z-10 space-y-8">
                <button
                    onClick={() => router.push('/chat')}
                    className="flex items-center gap-2 text-sm font-semibold hover:text-muted-foreground text-primary"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Return to Dashboard
                </button>

                <div className="bg-card backdrop-blur-3xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden">
                    <div className="h-32 bg-muted-foreground/20 flex items-end justify-center pb-0">
                        <div className="translate-y-1/2 p-1 bg-card rounded-full border border-border">
                            <div className="h-20 w-20 rounded-full bg-card flex items-center justify-center text-card-foreground">
                                <UserCircle2 className="h-12 w-12" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-14 p-8 space-y-8">
                        <div className="text-center space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight">Account Profile</h1>
                            <p className="text-sm text-muted-foreground">Manage your identity and preferences</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-zinc-500/5 p-4">
                                <Coins className="h-4 w-4 text-foreground" />
                                <span className="text-sm font-medium text-foreground">
                                    {new Intl.NumberFormat().format(user.availableTokenCount)} tokens
                                </span>
                            </div>
                            {/* Page count hidden — not shown to users
                            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-zinc-500/5 p-4">
                                <FileText className="h-4 w-4 text-foreground" />
                                <span className="text-sm font-medium text-foreground">
                                    {new Intl.NumberFormat().format(user.availablePageCount)} pages
                                </span>
                            </div>
                            */}
                        </div>

                        <div className="space-y-6">
                            {[
                                { id: 'name', label: 'Full Name', icon: User, value: user.name },
                                { id: 'email', label: 'Email Address', icon: Mail, value: user.email }
                            ].map((field) => (
                                <div key={field.id} className="space-y-1.5">
                                    <div className={`group p-4 rounded-2xl bg-zinc-500/5 border transition-all ${editField === field.id ? 'border-primary/40 bg-background' : 'border-border/50 hover:border-primary/40'
                                        }`}>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-secondary-foreground/80 mb-2 block ml-1">
                                            {field.label}
                                        </label>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-3 flex-1">
                                                <field.icon className={`h-4 w-4 ${editField === field.id ? 'text-primary' : 'text-foreground'}`} />
                                                {editField === field.id ? (
                                                    <Input
                                                        value={tempValue}
                                                        onChange={(e) => setTempValue(e.target.value)}
                                                        autoFocus
                                                        className="h-9 bg-muted-foreground/10! border-none focus-visible:ring-0 p-0 pl-2 text-sm font-medium"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(field.id as 'name' | 'email')}
                                                    />
                                                ) : (
                                                    <span className="text-sm font-medium text-foreground tracking-tight">
                                                        {field.value}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {editField === field.id ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdate(field.id as 'name' | 'email')}
                                                            disabled={updating}
                                                            className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors"
                                                        >
                                                            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                        </button>
                                                        <button
                                                            onClick={() => { setEditField(null); setFieldError(null); }}
                                                            className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => startEditing(field.id as 'name' | 'email', field.value)}
                                                        className="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-all"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5 text-foreground" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {editField === field.id && fieldError && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-destructive font-medium ml-2 animate-in slide-in-from-top-1">
                                            <AlertCircle className="h-3 w-3" />
                                            {fieldError}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
