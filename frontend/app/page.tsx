"use client"
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  LockKeyhole,
  MessageSquareText,
  Search,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/components/context/auth/auth-context";
const workflow = [
  {
    title: "Upload PDFs",
    text: "Bring contracts, reports, notes, or research files into one focused workspace.",
    icon: UploadCloud,
  },
  {
    title: "Index content",
    text: "paperAI prepares the document structure so answers can stay grounded.",
    icon: Search,
  },
  {
    title: "Ask questions",
    text: "Chat with the document, review summaries, and return to previous files.",
    icon: MessageSquareText,
  },
];

const highlights = [
  "Document history for repeat work",
  "Gemini and local Ollama model options",
  "Protected workspace for signed-in users",
];

export default function LandingPage() {
  const { isUserLoggedIn } = useAuth();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="fixed left-0 right-0 top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-md bg-foreground text-background">
              <Bot className="size-5" />
            </span>
            paperAI
          </Link>

          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              {!isUserLoggedIn && (
                <Link href="/login">Login</Link>
              )}
            </Button>
            <Button asChild>
              <Link href="/chat">
                Open Chat
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="min-h-[92vh] border-b border-border pt-16">
        <div className="mx-auto grid min-h-[calc(92vh-4rem)] w-full max-w-7xl items-center gap-10 px-5 py-14 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-amber-500" />
              AI document assistant for exam paper workflows
            </div>
            <h1 className="text-5xl font-bold tracking-normal text-foreground sm:text-6xl lg:text-7xl">
              paperAI
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Upload a PDF, generate a clear summary, and ask focused questions
              against the document content from a protected chat workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/chat">
                  Start Analyzing
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              {!isUserLoggedIn && (
                <Button size="lg" variant="outline" asChild>
                  <Link href="/register">Create Account</Link>
                </Button>
              )}
            </div>
            <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border bg-muted/70 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-400" />
                  <span className="size-3 rounded-full bg-amber-400" />
                  <span className="size-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LockKeyhole className="size-3.5" />
                  Secure workspace
                </div>
              </div>

              <div className="grid min-h-[520px] grid-cols-[1fr_240px] bg-background max-md:grid-cols-1">
                <div className="space-y-5 p-5">
                  <div className="rounded-lg border border-dashed border-cyan-500/50 bg-cyan-500/10 p-8 text-center">
                    <UploadCloud className="mx-auto mb-3 size-8 text-cyan-600 dark:text-cyan-400" />
                    <p className="font-medium">Drop financial-report.pdf</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      10 page PDF ready for indexing
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <FileText className="size-5 text-amber-500" />
                      <h2 className="font-semibold">Document Summary</h2>
                    </div>
                    <div className="space-y-3">
                      <span className="block h-3 w-full rounded bg-muted" />
                      <span className="block h-3 w-11/12 rounded bg-muted" />
                      <span className="block h-3 w-4/5 rounded bg-muted" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <MessageSquareText className="size-5 text-emerald-500" />
                      <h2 className="font-semibold">Ask the document</h2>
                    </div>
                    <div className="space-y-3">
                      <div className="max-w-[82%] rounded-lg bg-muted p-3 text-sm">
                        Which pages mention quarterly risk?
                      </div>
                      <div className="ml-auto max-w-[86%] rounded-lg bg-foreground p-3 text-sm text-background">
                        Pages 4 and 7 discuss risk exposure, with page 7
                        comparing the quarter-over-quarter change.
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="border-l border-border bg-muted/40 p-4 max-md:hidden">
                  <p className="mb-4 text-sm font-semibold">Recent documents</p>
                  {["Board notes", "Support handbook", "Research brief"].map(
                    (item, index) => (
                      <div
                        key={item}
                        className="mb-3 rounded-lg border border-border bg-background p-3"
                      >
                        <p className="text-sm font-medium">{item}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {index + 2} pages indexed
                        </p>
                      </div>
                    )
                  )}
                </aside>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-normal">
            Built For Document Questions
          </h2>
          <p className="mt-3 text-muted-foreground">
            The workflow stays close to the files your users already rely on:
            upload, summarize, ask, and return later.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {workflow.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-border bg-card p-6"
            >
              <item.icon className="mb-5 size-7 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
