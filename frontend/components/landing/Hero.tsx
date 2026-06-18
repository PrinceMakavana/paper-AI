"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { ArrowRight, Sparkles, Check, MessageSquare, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/layout/Reveal";
import { ExternalLinkAnchor } from "@/components/external-link-anchor";
import { ROUTES } from "@/lib/landing-links";
import landingChat from "@/data/landing-chat-sample.json";

const TRUST = [
  "10,00+ Study Material Processed",
  "GTU Focused",
  "Secure Workspace",
  "Google Gemini Support",
];
const INITIAL_VISIBLE_MESSAGE_COUNT = 4;

export function Hero() {

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
                <Link href={ROUTES.subjects}>
                  Start Studying
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              
              <Button size="lg" variant="outline" className="h-11 px-6" asChild>
                <Link href={ROUTES.subjects}>Browse Subjects <Package className="size-4" /></Link>
              </Button>
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
          <WorkspaceConversation />
        </Reveal>
      </div>
    </section>
  );
}

function WorkspaceConversation() {
  const timeline = useMemo(() => buildConversationTimeline(landingChat.messages as LandingChatMessage[]), []);
  const initialVisibleSteps = useMemo(
    () => getVisibleStepCountForMessages(timeline, INITIAL_VISIBLE_MESSAGE_COUNT),
    [timeline],
  );
  const [visibleSteps, setVisibleSteps] = useState(initialVisibleSteps);

  useEffect(() => {
    const isLoopComplete = visibleSteps >= timeline.length;
    const delay = isLoopComplete ? 2200 : timeline[visibleSteps]?.duration ?? 1200;
    const timeout = window.setTimeout(() => {
      setVisibleSteps((currentStep) =>
        currentStep >= timeline.length ? initialVisibleSteps : currentStep + 1,
      );
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [initialVisibleSteps, timeline, visibleSteps]);

  const visibleTimeline = timeline.slice(0, visibleSteps);
  const displayedTimeline = visibleTimeline.filter(
    (step, index) => step.type !== "thinking" || index === visibleTimeline.length - 1,
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-elevated)]">
      <div className="absolute inset-x-8 top-8 h-28 rounded-full bg-brand/15 blur-3xl" />
      <div className="relative flex items-center justify-between rounded-t-2xl border-b border-border/70 bg-muted/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-spark/80" />
          <span className="size-2.5 rounded-full bg-brand/80" />
        </div>
        <span className="text-xs text-muted-foreground">{landingChat.workspaceLabel}</span>
      </div>
      <div className="relative rounded-b-2xl bg-card p-4 sm:p-5">
        <div className="grid grid-cols-1 min-h-[390px] max-h-[430px] flex-col justify-end gap-3 overflow-auto">
          <BotBubble>
            Hi, I can help you find GTU subject material. Try asking by subject code or branch.
          </BotBubble>

          {displayedTimeline.map((step) => {
            if (step.type === "thinking") {
              return <ThinkingBubble key={step.id} />;
            }

            return step.message.role === "user" ? (
              <UserBubble key={step.id} message={step.message.content} />
            ) : (
              <AssistantBubble key={step.id} message={step.message} />
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {["Browse subjects"].map((label) => (
            <Link
              key={label}
              href={ROUTES.subjects}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: LandingChatMessage }) {
  const sections = parseAssistantSections(message.content);

  return (
    <BotBubble>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-brand">
        <Sparkles className="size-3.5" />
        {message.documentId === "catalog:global" ? "Found in catalog" : "AI response"}
      </div>
      <div className="space-y-3">
        {sections.map((section, index) =>
          section.label ? (
            <AnswerBlock key={index} label={section.label} highlight={isHighlightSection(section.label)}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={landingMarkdownComponents}>
                {section.body}
              </ReactMarkdown>
            </AnswerBlock>
          ) : (
            <div key={index} className="text-sm leading-relaxed text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={landingMarkdownComponents}>
                {section.body}
              </ReactMarkdown>
            </div>
          ),
        )}
      </div>
    </BotBubble>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-reveal flex items-start gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Sparkles className="size-4" />
      </div>
      <div className="max-w-[86%] rounded-2xl rounded-tl-md border border-border bg-background p-3 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: string }) {
  return (
    <div className="animate-reveal flex justify-end">
      <div className="flex max-w-[82%] items-center gap-2 rounded-2xl rounded-tr-md border border-brand/25 bg-brand/10 px-3 py-2.5 text-sm leading-relaxed">
        <span>{message}</span>
        <MessageSquare className="size-4 shrink-0 text-brand" />
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="animate-reveal flex items-center gap-2 pl-12">
      <div className="flex rounded-2xl border border-border bg-background px-3 py-2">
        <span className="mx-0.5 size-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        <span className="mx-0.5 size-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
        <span className="mx-0.5 size-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground">paperAI is thinking...</span>
    </div>
  );
}

function isHighlightSection(label: string) {
  return /exam|important|note/i.test(label);
}

function parseAssistantSections(content: string): { label?: string; body: string }[] {
  const chunks = content.split(/(?=^#{2,3}\s)/m).filter((chunk) => chunk.trim());
  if (chunks.length <= 1 && !/^#{2,3}\s/m.test(content)) {
    return [{ body: content.trim() }];
  }

  return chunks.map((chunk) => {
    const match = chunk.match(/^#{2,3}\s+(.+?)\n([\s\S]*)/);
    if (match) return { label: match[1].trim(), body: match[2].trim() };
    return { body: chunk.trim() };
  });
}

function AnswerBlock({
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
        "rounded-lg border p-3 " +
        (highlight
          ? "border-brand/40 bg-[color-mix(in_oklab,var(--brand)_8%,transparent)]"
          : "border-border bg-muted/30")
      }
    >
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

const landingMarkdownComponents: Components = {
  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm leading-relaxed last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) =>
    href ? <ExternalLinkAnchor href={href}>{children}</ExternalLinkAnchor> : <span>{children}</span>,
  code: ({ className, children, ...props }) => {
    const inline = !className;
    return inline ? (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props}>
        {children}
      </code>
    ) : (
      <code className={`block font-mono text-xs ${className ?? ""}`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 max-w-full overflow-x-auto rounded bg-muted p-3 text-xs last:mb-0">{children}</pre>
  ),
  h1: ({ children }) => <h1 className="mb-2 text-lg font-semibold leading-snug">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 text-base font-semibold leading-snug">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold leading-snug">{children}</h3>,
  blockquote: ({ children }) => (
    <div className="mb-3 rounded-lg border border-brand/40 bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] p-3 last:mb-0">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Note
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  ),
  hr: () => <hr className="my-3 border-current opacity-20" />,
};

function buildConversationTimeline(messages: LandingChatMessage[]): ConversationTimelineStep[] {
  return messages.flatMap((message) => {
    if (message.role === "user") {
      return [
        { id: message.id, type: "message" as const, message, duration: 1100 },
        { id: `${message.id}-thinking`, type: "thinking" as const, duration: 1350 },
      ];
    }

    return [{ id: message.id, type: "message" as const, message, duration: 2300 }];
  });
}

function getVisibleStepCountForMessages(
  timeline: ConversationTimelineStep[],
  messageCount: number,
) {
  let visibleMessages = 0;

  for (let index = 0; index < timeline.length; index += 1) {
    if (timeline[index].type === "message") {
      visibleMessages += 1;
    }

    if (visibleMessages >= messageCount) {
      return index + 1;
    }
  }

  return timeline.length;
}

type ConversationTimelineStep =
  | {
      id: string;
      type: "message";
      message: LandingChatMessage;
      duration: number;
    }
  | {
      id: string;
      type: "thinking";
      duration: number;
    };

type LandingChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chatModel?: string;
  documentId?: string;
  displayContent?: string;
};
