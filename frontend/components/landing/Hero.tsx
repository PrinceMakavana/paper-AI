"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Check, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/layout/Reveal";
import { useAuth } from "@/components/context/auth/auth-context";
import { signupHref, startChatHref } from "@/lib/landing-links";

const TRUST = [
  "10,00+ Study Material Processed",
  "GTU Focused",
  "Secure Workspace",
  "Google Gemini Support",
];

export function Hero() {
  const { isUserLoggedIn } = useAuth();

  return (
    <section className="relative overflow-hidden border-b border-border pt-24">
      <div className="absolute inset-0 hero-bg pointer-events-none" />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1fr_1.05fr] lg:pb-28">
        <div>
          <Reveal>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-spark" />
              AI-powered GTU Study Assistant
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              AI-Powered GTU Study Assistant &{" "}
              <span className="bg-gradient-to-r from-foreground to-brand bg-clip-text text-transparent">
                Document Assistant
              </span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Upload study material, generate accurate answers, chat with documents, summarize notes,
              and prepare smarter for GTU studies using AI.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-11 px-6" asChild>
                <Link href={signupHref(isUserLoggedIn)}>
                  Start Studying
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              {!isUserLoggedIn && (
              <Button size="lg" variant="outline" className="h-11 px-6" asChild>
                  <Link href={startChatHref(isUserLoggedIn)}>Try Demo</Link>
                </Button>
              )}
            </div>
          </Reveal>
          <Reveal delay={320}>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-muted-foreground">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-brand" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <Reveal delay={200}>
          <MockAnswer />
        </Reveal>
      </div>
    </section>
  );
}

function MockAnswer() {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-elevated)]">
      <div className="flex items-center justify-between rounded-t-xl bg-muted/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-spark/80" />
          <span className="size-2.5 rounded-full bg-brand/80" />
        </div>
        <span className="text-xs text-muted-foreground">paperAI workspace</span>
      </div>
      <div className="rounded-b-xl bg-card p-5">
        <div className="flex items-center items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-background text-muted-foreground">
            <MessageSquare className="size-4" />
          </div>
          <p className="text-sm">
            Explain the difference between <span className="font-medium">Abstract Class</span> and{" "}
            <span className="font-medium">Interface</span>.
          </p>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-background p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand">
            <Sparkles className="size-3.5" />
            AI Generated Answer
          </div>
          <div className="space-y-3 text-sm">
            <Block label="Definition">
              An abstract class can have both implemented and abstract methods. An interface defines a
              contract of methods a class must implement.
            </Block>
            <Block label="Example">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">abstract class Shape</code> vs{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">interface Drawable</code>
            </Block>
            <Block label="Key Differences">
              Inheritance type, constructors, access modifiers, multiple inheritance support.
            </Block>
            <Block label="Exam Important Notes" highlight>
              Frequently asked 7-mark question. Mention at least 4 differences with examples.
            </Block>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <FileText className="size-3.5" />
            Generated from Winter 2024 GTU Paper
          </span>
          {/* <span className="font-medium text-brand">Gemini · OOP2</span> */}
        </div>
      </div>
    </div>
  );
}

function Block({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md border p-3 " +
        (highlight
          ? "border-brand/40 bg-[color-mix(in_oklab,var(--brand)_8%,transparent)]"
          : "border-border bg-muted/30")
      }
    >
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
