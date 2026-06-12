import { isSubjectChatReady } from "@/lib/catalog-api";
import { ChatMessage, DocumentMetaData, SubjectDetail } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Eye, FileText, Loader2, Send } from "lucide-react";
import type { AIModel } from "@/lib/ai-model";
import { useAlert } from "./context/alert/alert-context";
import { PAPERAI_API_PREFIX } from "@/lib/constant";
import { getToken } from "@/lib/utils";

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const MESSAGE_FONT_SIZE = "1rem";
const MESSAGE_LINE_HEIGHT = 1.75;

function markdownComponents(role: "user" | "assistant"): Components {
  const isUser = role === "user";
  const codeBase = isUser
    ? "bg-white/20 text-white"
    : "bg-[#e8e6e1]/60 text-[#1a1917]";

  return {
    p: ({ children }) => (
      <p
        style={{
          marginBottom: "0.75rem",
          lineHeight: MESSAGE_LINE_HEIGHT,
          fontSize: MESSAGE_FONT_SIZE,
        }}
        className="last:mb-0"
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
    a: ({ href, children }) => (
      <a href={href} style={{ textDecoration: "underline", textUnderlineOffset: 2, opacity: 0.85 }} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
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
      <blockquote
        style={{
          borderLeft: "3px solid currentColor",
          paddingLeft: "0.875rem",
          opacity: 0.9,
          fontStyle: "italic",
          marginBottom: "0.75rem",
          lineHeight: MESSAGE_LINE_HEIGHT,
        }}
        className="last:mb-0"
      >
        {children}
      </blockquote>
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

interface CatalogMatchItem {
  type: string;
  label: string;
  url: string;
}

interface CatalogMatchGroup {
  subjectCode: string;
  subjectName: string;
  knownAs?: string;
  chatReady?: boolean;
  items: CatalogMatchItem[];
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

interface ChatMessagesResponse {
  status: number;
  message?: string;
  messages?: ChatMessage[];
}

interface QuestionResponse {
  status: number;
  answer?: string;
  answer_source?: "book" | "not_in_book" | "catalog";
  intent?: "find_material" | "study_question";
  matches?: CatalogMatchGroup[];
  suggestedSubjectCodes?: string[];
  paper_solution_url?: string | null;
  message?: ChatMessage | string;
  available_token_count?: number;
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  'Access-Control-Allow-Origin': '*',
  'ngrok-skip-browser-warning': 'true',
});

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
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const chatContextKey = currentSubject
    ? `subject:${currentSubject.subjectCode}`
    : currentDocument?.id
      ? currentDocument.id
      : catalogFindMode
        ? "catalog:global"
        : undefined;

  useEffect(() => {
    if (!chatContextKey) {
      setMessages([]);
      return;
    }

    let ignore = false;
    const loadChatHistory = async () => {
      try {
        setHistoryLoading(true);
        const historyUrl = currentSubject
          ? `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/chat-messages/subject/${encodeURIComponent(currentSubject.subjectCode)}`
          : currentDocument
            ? `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/chat-messages/${encodeURIComponent(currentDocument.id)}`
            : catalogFindMode
              ? `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/chat-messages/catalog/global`
              : null;
        if (!historyUrl) {
          setMessages([]);
          return;
        }
        const response = await fetch(historyUrl, { headers: getAuthHeaders() });
        const data: ChatMessagesResponse = await response.json();
        if (ignore) return;
        if (!response.ok || data.status !== 200) {
          showAlert(data.message || "Failed to load chat history", "error");
          setMessages([]);
          return;
        }
        setMessages(data.messages ?? []);
      } catch (error) {
        if (ignore) return;
        showAlert(error instanceof Error ? error.message : "Failed to load chat history", "error");
        setMessages([]);
      } finally {
        if (!ignore) setHistoryLoading(false);
      }
    };

    loadChatHistory();
    return () => { ignore = true; };
  }, [chatContextKey, catalogFindMode, currentDocument, currentSubject, showAlert]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    const isCatalogMode = catalogFindMode && !currentSubject && !currentDocument;
    const isDocumentMode = !!currentDocument && !currentSubject && !catalogFindMode;
    const isSubjectMode = !!currentSubject && !currentDocument && !catalogFindMode;

    if (
      !input.trim() ||
      loading ||
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
      setLoading(true);
      const endpoint = isCatalogMode
        ? `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/catalog-find`
        : isSubjectMode
          ? `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/subject-question-rag`
          : `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/question-vectorless-rag`;
      const body = isCatalogMode
        ? { question, chatModel: selectedModel }
        : isSubjectMode
          ? { question, subjectCode: currentSubject!.subjectCode, chatModel: selectedModel }
          : { question, documentId: currentDocument!.id, chatModel: selectedModel };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data: QuestionResponse = await response.json();
      if (!response.ok || data.status !== 200) {
        showAlert(
          (typeof data.message === "string" && data.message) || data.answer || "An unknown error occurred",
          "error",
        );
        setMessages((prev) => prev.slice(0, -1));
      } else {
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
      }
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "An unknown error occurred", "error");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!chatContextKey) return;
    try {
      setHistoryLoading(true);
      const deleteUrl = currentSubject
        ? `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/chat-messages/subject/${encodeURIComponent(currentSubject.subjectCode)}`
        : currentDocument
          ? `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/chat-messages/${encodeURIComponent(currentDocument.id)}`
          : catalogFindMode
            ? `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/chat-messages/catalog/global`
            : null;
      if (!deleteUrl) return;
      const response = await fetch(deleteUrl, { method: "DELETE", headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        showAlert(data.message || "Failed to clear chat history", "error");
        return;
      }
      setMessages([]);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to clear chat history", "error");
    } finally {
      setHistoryLoading(false);
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
    <div
      className="ed-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        maxHeight: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--ed-bg)",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          borderBottom: "1px solid var(--ed-rule)",
          padding: "0.5rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "var(--ed-surface)",
          minHeight: "2.75rem",
          flexShrink: 0,
        }}
      >
        {hasChatContext ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
              <FileText size={13} style={{ color: "var(--ed-faint)", flexShrink: 0 }} />
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--ed-ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {contextLabel}
              </span>
              {isDocumentMode && onViewPdf && currentDocument && (
                <button
                  type="button"
                  title="View PDF"
                  aria-label={`View ${currentDocument.filename}`}
                  onClick={() => onViewPdf(currentDocument)}
                  style={{
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ed-faint)",
                    cursor: "pointer",
                    transition: "color 0.15s, background-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--ed-accent)";
                    e.currentTarget.style.backgroundColor = "var(--ed-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--ed-faint)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Eye size={14} />
                </button>
              )}
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                disabled={historyLoading || loading}
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--ed-muted)",
                  flexShrink: 0,
                  marginLeft: "0.75rem",
                  transition: "color 0.15s",
                  cursor: historyLoading || loading ? "default" : "pointer",
                }}
                onMouseEnter={(e) => { if (!historyLoading && !loading) e.currentTarget.style.color = "#dc2626"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ed-muted)"; }}
              >
                Clear history
              </button>
            )}
          </>
        ) : (
          <span style={{ fontSize: "0.875rem", color: "var(--ed-muted)" }}>
            Select Find materials, a subject, or upload a PDF
          </span>
        )}
      </div>

      {/* Messages */}
      <div
        className="ed-panel-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {historyLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--ed-muted)", padding: "3rem 0" }}>
              <Loader2 size={15} className="animate-spin" />
              <span style={{ fontSize: "0.9375rem" }}>Loading history…</span>
            </div>
          ) : messages.length === 0 && hasChatContext ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <p style={{ fontSize: "1rem", lineHeight: 1.6, color: "var(--ed-muted)" }}>
                {isCatalogMode ? (
                  <>
                    Ask for books, syllabus, or exam papers across all GTU subjects.
                    <br />
                    <span style={{ fontSize: "0.875rem", color: "var(--ed-faint)" }}>
                      For explanations, select a subject from the sidebar.
                    </span>
                  </>
                ) : isContextReady ? (
                  <>
                    Ask anything about{" "}
                    <em className="font-fraunces" style={{ fontStyle: "italic", fontWeight: 300, color: "var(--ed-muted)" }}>
                      {contextLabel}
                    </em>
                  </>
                ) : (
                  <>
                    Preparing{" "}
                    <em className="font-fraunces" style={{ fontStyle: "italic", fontWeight: 300, color: "var(--ed-muted)" }}>
                      {contextLabel}
                    </em>
                  </>
                )}
              </p>
            </div>
          ) : null}

          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                width: "100%",
                justifyContent: message.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  width: "fit-content",
                  maxWidth: "min(85%)",
                  padding: "0.75rem 1rem",
                  borderRadius: 4,
                  backgroundColor: message.role === "user" ? "var(--ed-accent)" : "#ffffff",
                  color: message.role === "user" ? "#ffffff" : "var(--ed-ink)",
                  border: message.role === "assistant" ? "1px solid var(--ed-rule)" : "none",
                  fontSize: MESSAGE_FONT_SIZE,
                  lineHeight: MESSAGE_LINE_HEIGHT,
                  letterSpacing: "0.01em",
                  boxShadow: message.role === "assistant" ? "0 1px 2px rgba(26, 25, 23, 0.04)" : "none",
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents(message.role)}>
                  {message.content}
                </ReactMarkdown>
                <div
                  style={{
                    fontSize: "0.75rem",
                    marginTop: "0.5rem",
                    color: message.role === "user" ? "rgba(255, 255, 255, 0.82)" : "var(--ed-muted)",
                    textAlign: message.role === "user" ? "right" : "left",
                  }}
                >
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          {
            loading && (
               <div
              key={"loading"}
              style={{ display: "flex", width: "100%", justifyContent: "flex-start" }}
            >
              <div
                style={{
                  width: "fit-content",
                  maxWidth: "min(85%)",
                  padding: "0.75rem 1rem",
                  borderRadius: 4,
                  backgroundColor: "#ffffff",
                  color: "var(--ed-ink)",
                  border: "1px solid var(--ed-rule)",
                  fontSize: MESSAGE_FONT_SIZE,
                  lineHeight: MESSAGE_LINE_HEIGHT,
                  boxShadow: "0 1px 2px rgba(26, 25, 23, 0.04)",
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents("assistant")}>
                  {"Typing..."}
                </ReactMarkdown>
                <div style={{ marginTop: "0.5rem" }} />
              </div>
            </div>
            )
          }
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div
        style={{
          borderTop: "1px solid var(--ed-rule)",
          padding: "0.625rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          backgroundColor: "var(--ed-bg)",
          flexShrink: 0,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={inputPlaceholder}
          disabled={loading || historyLoading || !hasChatContext || !isContextReady || !hasTokens}
          className="font-instrument"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "1rem",
            lineHeight: 1.5,
            backgroundColor: "transparent",
            color: "var(--ed-ink)",
            minWidth: 0,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            backgroundColor: canSend ? "var(--ed-accent)" : "var(--ed-rule)",
            color: canSend ? "#ffffff" : "var(--ed-faint)",
            border: "none",
            borderRadius: 2,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canSend ? "pointer" : "default",
            transition: "background-color 0.15s",
            flexShrink: 0,
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}
