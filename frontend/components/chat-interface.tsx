import { isSubjectChatReady } from "@/lib/catalog-utils";
import { ChatMessage, DocumentMetaData, SubjectDetail } from "@/lib/types";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Eye, FileText, Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { ExternalLinkAnchor } from "@/components/external-link-anchor";
import type { AIModel } from "@/lib/ai-model";
import { useAlert } from "./context/alert/alert-context";
import {
  useAskQuestionMutation,
  useDeleteChatMessagesMutation,
  useGetChatMessagesQuery,
} from "@/storage/services/paperaiApi";
import type { ChatContext } from "@/storage/types/paperai";

const MESSAGE_FONT_SIZE = "0.875rem";
const MESSAGE_LINE_HEIGHT = 1.65;

function isHighlightSection(label: string) {
  return /exam|important|note/i.test(label);
}

function parseAssistantSections(content: string): { label?: string; body: string }[] {
  const chunks = content.split(/(?=^#{2,3}\s)/m).filter((c) => c.trim());
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
  children: ReactNode;
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

function markdownComponents(role: "user" | "assistant"): Components {
  const codeBase = "rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground";

  return {
    p: ({ children }) => (
      <p
        style={{
          marginBottom: "0.75rem",
          lineHeight: MESSAGE_LINE_HEIGHT,
          fontSize: MESSAGE_FONT_SIZE,
        }}
        className="last:mb-0!"
      >
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul
        style={{ marginBottom: "0.75rem", paddingLeft: "1.25rem", listStyleType: "disc" }}
        className="last:mb-0 space-y-1"
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        style={{ marginBottom: "0.75rem", paddingLeft: "1.25rem", listStyleType: "decimal" }}
        className="last:mb-0 space-y-1"
      >
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li style={{ lineHeight: MESSAGE_LINE_HEIGHT, fontSize: MESSAGE_FONT_SIZE }}>{children}</li>
    ),
    strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
    a: ({ href, children }) =>
      href ? (
        <ExternalLinkAnchor href={href}>{children}</ExternalLinkAnchor>
      ) : (
        <span>{children}</span>
      ),
    code: ({ className, children, ...props }) => {
      const inline = !className;
      return inline ? (
        <code className={`rounded px-1 py-0.5 font-mono text-[0.85em] ${codeBase}`} {...props}>{children}</code>
      ) : (
        <code className={`block font-mono text-xs ${className ?? ""}`} {...props}>{children}</code>
      );
    },
    pre: ({ children }) => (
      <pre className={`mb-2 max-w-full overflow-x-auto rounded p-3 text-xs last:mb-0 ${codeBase}`}>{children}</pre>
    ),
    h1: ({ children }) => (
      <h1 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem", lineHeight: 1.4 }}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, marginBottom: "0.5rem", lineHeight: 1.4 }}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem", lineHeight: 1.4 }}>
        {children}
      </h3>
    ),
    blockquote: ({ children }) => (
      <div className="mb-3 last:mb-0 rounded-lg border border-brand/40 bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Note
        </div>
        <div className="text-sm leading-relaxed not-italic">{children}</div>
      </div>
    ),
    hr: () => <hr style={{ borderColor: "currentColor", opacity: 0.2, margin: "0.75rem 0" }} />,
    table: ({ children }) => (
      <div style={{ overflowX: "auto", marginBottom: "0.45rem" }} className="last:mb-0">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th style={{ border: "1px solid rgba(0,0,0,0.15)", padding: "0.25rem 0.5rem", textAlign: "left", fontWeight: 600 }}>{children}</th>
    ),
    td: ({ children }) => (
      <td style={{ border: "1px solid rgba(0,0,0,0.12)", padding: "0.25rem 0.5rem", verticalAlign: "top" }}>{children}</td>
    ),
  };
}

function UserMessage({ content, timestamp }: { content: string; timestamp: Date | string }) {
  return (
    <div className="w-[85%] self-end">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-2 py-1">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground">
          <MessageSquare className="size-4" />
        </div>
        <div className="min-w-0 flex-1 ">
          <div className="text-sm leading-relaxed text-foreground">
            <ReactMarkdown  remarkPlugins={[remarkGfm]} components={markdownComponents("user")}>
              {content}
            </ReactMarkdown>
          </div>
          {/* <p className="mt-2 text-right text-[11px] text-muted-foreground">
            {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p> */}
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({
  content,
  timestamp,
  sourceLabel,
}: {
  content: string;
  timestamp: Date | string;
  sourceLabel?: string;
}) {
  const sections = parseAssistantSections(content);

  return (
    <div className="w-[85%] space-y-3">
      <div className="rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand">
          <Sparkles className="size-3.5" />
        </div>
        <div className="space-y-3">
          {sections.map((section, index) =>
            section.label ? (
              <AnswerBlock
                key={index}
                label={section.label}
                highlight={isHighlightSection(section.label)}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents("assistant")}>
                  {section.body}
                </ReactMarkdown>
              </AnswerBlock>
            ) : (
              <div key={index} className="text-sm leading-relaxed text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents("assistant")}>
                  {section.body}
                </ReactMarkdown>
              </div>
            ),
          )}
        </div>
      </div>
      {/* {sourceLabel && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">Generated from {sourceLabel}</span>
          </span>
          <span className="ml-3 shrink-0">
            {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )} */}
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="w-[85%]">
      <div className="rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-brand">
          <Sparkles className="size-3.5" />
          AI Generated Answer
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span>Generating answer…</span>
        </div>
      </div>
    </div>
  );
}

interface ChatInterFaceProps {
  currentDocument?: DocumentMetaData;
  currentSubject?: SubjectDetail;
  catalogFindMode?: boolean;
  selectedModel: AIModel;
  availableTokenCount: number;
  onTokenBalanceChange?: (availableTokenCount: number) => void;
  onRefreshUser?: () => Promise<void>;
  onViewPdf?: (document: DocumentMetaData) => void;
  onSelectSubject?: (subjectCode: string) => void;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string; error?: string } }).data;
    return data?.message || data?.error || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function buildChatContext(
  currentDocument?: DocumentMetaData,
  currentSubject?: SubjectDetail,
  catalogFindMode?: boolean,
): ChatContext | undefined {
  if (currentSubject) {
    return { type: "subject", subjectCode: currentSubject.subjectCode };
  }
  if (currentDocument) {
    return { type: "document", documentId: currentDocument.id };
  }
  if (catalogFindMode) {
    return { type: "catalog" };
  }
  return undefined;
}

export function ChatInterFace({
  currentDocument,
  currentSubject,
  catalogFindMode = false,
  selectedModel,
  availableTokenCount,
  onTokenBalanceChange,
  onRefreshUser,
  onViewPdf,
  onSelectSubject,
}: ChatInterFaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const { showAlert } = useAlert();
  const [askQuestion, { isLoading: loading }] = useAskQuestionMutation();
  const [deleteChatMessages, { isLoading: clearingHistory }] =
    useDeleteChatMessagesMutation();

  const chatContext = useMemo(
    () => buildChatContext(currentDocument, currentSubject, catalogFindMode),
    [catalogFindMode, currentDocument, currentSubject],
  );

  const {
    data: historyMessages = [],
    isLoading: historyLoading,
    isError: historyError,
    error: historyQueryError,
  } = useGetChatMessagesQuery(chatContext!, { skip: !chatContext });

  useEffect(() => {
    if (!chatContext) {
      setMessages([]);
      return;
    }
    if (!historyLoading) {
      setMessages(historyMessages);
    }
  }, [chatContext, historyLoading, historyMessages]);

  useEffect(() => {
    if (historyError) {
      showAlert(getApiErrorMessage(historyQueryError, "Failed to load chat history"), "error");
      setMessages([]);
    }
  }, [historyError, historyQueryError, showAlert]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    const isCatalogMode = catalogFindMode && !currentSubject && !currentDocument;
    const isDocumentMode = !!currentDocument && !currentSubject && !catalogFindMode;
    const isSubjectMode = !!currentSubject && !currentDocument && !catalogFindMode;

    if (
      !input.trim() ||
      loading ||
      !chatContext ||
      availableTokenCount <= 0 ||
      (!isDocumentMode && !isSubjectMode && !isCatalogMode)
    ) return;

    if (isDocumentMode && currentDocument.indexStatus !== "complete") return;
    if (isSubjectMode && !isSubjectChatReady(currentSubject)) return;

    const question = input.trim();
    const contextId = isCatalogMode
      ? "catalog:global"
      : isSubjectMode
        ? `subject:${currentSubject!.subjectCode}`
        : currentDocument!.id;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      timestamp: new Date(),
      documentId: contextId,
      subjectCode: isSubjectMode ? currentSubject!.subjectCode : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const data = await askQuestion({
        context: chatContext,
        question,
        chatModel: selectedModel,
      }).unwrap();

      if (data.status !== 200) {
        showAlert(
          (typeof data.message === "string" && data.message) || data.answer || "An unknown error occurred",
          "error",
        );
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (typeof data.available_token_count === "number") {
        onTokenBalanceChange?.(data.available_token_count);
        void onRefreshUser?.();
      } else {
        await onRefreshUser?.();
      }

      const aiMessage: ChatMessage = {
        id: typeof data.message === "object" ? data.message.id : crypto.randomUUID(),
        role: "assistant",
        content: typeof data.message === "object" ? data.message.content : (data.answer ?? ""),
        timestamp: typeof data.message === "object" ? data.message.timestamp : new Date(),
        documentId: typeof data.message === "object" ? data.message.documentId : contextId,
        subjectCode: isSubjectMode ? currentSubject!.subjectCode : undefined,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      showAlert(getApiErrorMessage(error, "An unknown error occurred"), "error");
      setMessages((prev) => prev.slice(0, -1));
    }
  };

  const clearHistory = async () => {
    if (!chatContext) return;
    try {
      const data = await deleteChatMessages(chatContext).unwrap();
      if (data.status !== 200) {
        showAlert(data.message || "Failed to clear chat history", "error");
        return;
      }
      setMessages([]);
    } catch (error) {
      showAlert(getApiErrorMessage(error, "Failed to clear chat history"), "error");
    }
  };

  const isCatalogMode = catalogFindMode && !currentSubject && !currentDocument;
  const isDocumentMode = !!currentDocument && !currentSubject && !catalogFindMode;
  const isSubjectMode = !!currentSubject && !currentDocument && !catalogFindMode;
  const hasChatContext = isDocumentMode || isSubjectMode || isCatalogMode;
  const isDocumentReady = currentDocument?.indexStatus === "complete";
  const isSubjectReady = isSubjectChatReady(currentSubject);
  const isContextReady = isCatalogMode ? true : isDocumentMode ? isDocumentReady : isSubjectReady;
  const hasTokens = availableTokenCount > 0;
  const canSend =
    !loading &&
    !historyLoading &&
    hasChatContext &&
    isContextReady &&
    hasTokens &&
    !!input.trim();
  const contextLabel = isCatalogMode
    ? "Find materials"
    : isSubjectMode
      ? `${currentSubject!.subjectName} (${currentSubject!.subjectCode})`
      : currentDocument?.filename;
  const inputPlaceholder = !hasChatContext
    ? "Select Find materials, a subject, or upload a PDF"
    : !hasTokens
      ? "Token balance exhausted"
      : isCatalogMode
        ? "e.g. maths summer 2023 paper, PPS books, 3110003 syllabus"
        : isContextReady
          ? "Ask a question…"
          : isSubjectMode
            ? "Subject books are still being indexed…"
            : "Document is still indexing…";

  return (
    <div className="flex min-h-0 max-h-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      {/* Top bar */}
      <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
        {hasChatContext ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <FileText size={14} className="shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium text-foreground">
                {contextLabel}
              </span>
              {isDocumentMode && onViewPdf && currentDocument && (
                <button
                  type="button"
                  title="View PDF"
                  aria-label={`View ${currentDocument.filename}`}
                  onClick={() => onViewPdf(currentDocument)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-brand"
                >
                  <Eye size={14} />
                </button>
              )}
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                disabled={historyLoading || loading || clearingHistory}
                className="ml-3 shrink-0 text-[13px] text-muted-foreground transition-colors hover:text-destructive disabled:cursor-default"
              >
                Clear history
              </button>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            Select Find materials, a subject, or upload a PDF
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="ed-panel-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          {historyLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 size={15} className="animate-spin" />
              <span className="text-sm">Loading history…</span>
            </div>
          ) : messages.length === 0 && hasChatContext ? (
            <div className="px-4 py-12 text-center">
              <p className="text-base leading-relaxed text-muted-foreground">
                {isCatalogMode ? (
                  <>
                    Ask for books, syllabus, or exam papers across all GTU subjects.
                    <br />
                    <span className="text-sm text-muted-foreground/80">
                      For explanations, select a subject from the sidebar.
                    </span>
                  </>
                ) : isContextReady ? (
                  <>
                    Ask anything about{" "}
                    <em className="font-medium not-italic text-foreground">{contextLabel}</em>
                  </>
                ) : (
                  <>
                    Preparing{" "}
                    <em className="font-medium not-italic text-foreground">{contextLabel}</em>
                  </>
                )}
              </p>
            </div>
          ) : null}

          {messages.map((message, index) =>
            message.role === "user" ? (
              <UserMessage key={index} content={message.content} timestamp={message.timestamp} />
            ) : (
              <AssistantMessage
                key={index}
                content={message.content}
                timestamp={message.timestamp}
                sourceLabel={contextLabel}
              />
            ),
          )}
          {loading && <LoadingMessage />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="flex shrink-0 items-center gap-2.5 border-t border-border bg-muted/30 px-4 py-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={inputPlaceholder}
          disabled={loading || historyLoading || clearingHistory || !hasChatContext || !isContextReady || !hasTokens}
          className="min-w-0 flex-1 border-none bg-transparent text-base leading-normal text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors " +
            (canSend
              ? "bg-brand text-white hover:opacity-90"
              : "cursor-default bg-muted text-muted-foreground")
          }
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}
