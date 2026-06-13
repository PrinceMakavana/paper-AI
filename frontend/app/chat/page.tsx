"use client";

import { ChatInterFace } from "@/components/chat-interface";
import { BuyTokenDialog } from "@/components/buy-token-dialog";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";
import { DocumentHistory } from "@/components/document-history";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { SubjectCatalog } from "@/components/subject-catalog";
import { fetchSubject, fetchSubjects } from "@/lib/catalog-api";
import { DocumentMetaData, SubjectDetail, SubjectSummary } from "@/lib/types";
import { Coins, FileText, Loader2, LogOut, UserCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
import { useAlert } from "@/components/context/alert/alert-context";
import { useAuth } from "@/components/context/auth/auth-context";
// import type { AIModel } from "@/lib/ai-model";
import { PAPERAI_API_PREFIX } from "@/lib/constant";
import { loadRazorpayScript } from "@/lib/razorpay";
import { getToken, validateFile } from "@/lib/utils";
import { useRouter } from "next/navigation";

const CURRENT_DOCUMENT_ID_STORAGE_KEY = "paperai-current-document-id";
const CURRENT_SUBJECT_CODE_STORAGE_KEY = "paperai-current-subject-code";
const CATALOG_FIND_MODE_STORAGE_KEY = "paperai-catalog-find-mode";
const LEGACY_DOCUMENT_ID_STORAGE_KEY = "pageindex-current-document-id";
const LEGACY_SUBJECT_CODE_STORAGE_KEY = "pageindex-current-subject-code";

function migrateStorageKey(newKey: string, legacyKey: string): string | null {
  try {
    const value = localStorage.getItem(newKey) ?? localStorage.getItem(legacyKey);
    if (value === null) return null;
    localStorage.setItem(newKey, value);
    localStorage.removeItem(legacyKey);
    return value;
  } catch {
    return null;
  }
}
const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const INDEX_STATUS_POLL_INTERVAL_MS = 10000;
const UPLOAD_COMING_SOON = true;
const PENDING_INDEX_STATUSES = new Set(["queued", "running", "unknown"]);

const getAuthHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  "Access-Control-Allow-Origin": "*",
  'ngrok-skip-browser-warning': 'true',
});

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data.message || data.error || fallback;
  } catch {
    return response.text().then((message) => message || fallback);
  }
}

interface DocumentStatusResponse {
  status: number;
  message?: string;
  documentId?: string;
  indexStatus?: string;
  document?: DocumentMetaData;
}

interface PdfUrlResponse {
  status: number;
  url?: string;
  expiresIn?: number;
  message?: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentMetaData[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | undefined>(undefined);
  // const [selectedModel, setSelectedModel] = useState<AIModel>("gemini");
  const selectedModel = "gemini";
  const [currentDocument, setCurrentDocument] = useState<DocumentMetaData | undefined>(undefined);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<SubjectDetail | undefined>(undefined);
  const [catalogFindMode, setCatalogFindMode] = useState(false);
  const [chatSelectionReady, setChatSelectionReady] = useState(false);
  const documentsRef = useRef<DocumentMetaData[]>([]);
  const { isUserLoggedIn, user, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const { logout } = useAuth();
  const [availableTokenCount, setAvailableTokenCount] = useState(0);
  const [availablePageCount, setAvailablePageCount] = useState(0);
  const [isBuyTokenOpen, setIsBuyTokenOpen] = useState(false);
  const [buyingTokens, setBuyingTokens] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pdfViewerDocument, setPdfViewerDocument] = useState<DocumentMetaData | undefined>(undefined);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | undefined>(undefined);
  const [pdfViewerLoading, setPdfViewerLoading] = useState(false);
  const [pdfViewerError, setPdfViewerError] = useState<string | undefined>(undefined);

  const hasTokens = availableTokenCount > 0;
  const hasPages = availablePageCount > 0;
  const canUpload = !UPLOAD_COMING_SOON && hasTokens && hasPages;
  const tokenLabel = new Intl.NumberFormat(undefined, {
    notation: availableTokenCount >= 1000 ? "compact" : "standard",
    maximumFractionDigits: availableTokenCount >= 1000 ? 1 : 0,
  }).format(Math.max(availableTokenCount, 0));
  const pageLabel = new Intl.NumberFormat(undefined, {
    notation: availablePageCount >= 1000 ? "compact" : "standard",
    maximumFractionDigits: availablePageCount >= 1000 ? 1 : 0,
  }).format(Math.max(availablePageCount, 0));

  const showFindMaterialsHeader =
    !currentSubject && !currentDocument && (catalogFindMode || !chatSelectionReady);
  const isFindMaterialsActive =
    !currentSubject && !currentDocument && (catalogFindMode || !chatSelectionReady);
  const effectiveCatalogFindMode =
    catalogFindMode || (!chatSelectionReady && !currentSubject && !currentDocument);

  const handleLogoutClick = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      setSigningOut(true);
      await logout();
    } finally {
      setSigningOut(false);
      setIsLogoutConfirmOpen(false);
    }
  };
  const userProfile = () => { router.push("/profile"); };

  useEffect(() => {
    setAvailableTokenCount(Number(user?.available_token_count ?? 0));
    setAvailablePageCount(Number(user?.available_page_count ?? 0));
  }, [user?.available_token_count, user?.available_page_count]);

  const fetchSubjectsList = useCallback(async () => {
    try {
      setSubjectsLoading(true);
      const fetched = await fetchSubjects();
      setSubjects(fetched);
      return fetched;
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to load subjects", "error");
      return [];
    } finally {
      setSubjectsLoading(false);
    }
  }, [showAlert]);

  const fetchDocuments = useCallback(async () => {
    try {
      setDocumentsLoading(true);
      const response = await fetch(`${BACKEND_API_URL}${PAPERAI_API_PREFIX}/documents`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const data = await response.json();
        showAlert(data.message ?? "Failed to load documents", "error");
        return [];
      }
      const data = await response.json();
      const fetched: DocumentMetaData[] = data.documents ?? [];
      setDocuments(fetched);
      const savedId = migrateStorageKey(
        CURRENT_DOCUMENT_ID_STORAGE_KEY,
        LEGACY_DOCUMENT_ID_STORAGE_KEY,
      );
      if (savedId) {
        const match = fetched.find((d) => d.id === savedId);
        if (match) {
          localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
          setCatalogFindMode(false);
          setCurrentSubject(undefined);
          setCurrentDocument(match);
          setSummary(match.summary ?? "");
        }
        setChatSelectionReady(true);
      }
      return fetched;
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to load documents", "error");
      return [];
    } finally {
      setDocumentsLoading(false);
    }
  }, [showAlert]);

  const pendingDocumentsKey = useMemo(
    () =>
      documents
        .filter((doc) => PENDING_INDEX_STATUSES.has(doc.indexStatus ?? "unknown"))
        .map((doc) => `${doc.id}:${doc.indexStatus ?? "unknown"}`)
        .sort()
        .join("|"),
    [documents],
  );

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    if (isUserLoggedIn) {
      fetchDocuments();
      fetchSubjectsList();
    } else {
      router.push("/login");
    }
  }, [fetchDocuments, fetchSubjectsList, isUserLoggedIn, router]);

  useEffect(() => {
    const savedSubjectCode = migrateStorageKey(
      CURRENT_SUBJECT_CODE_STORAGE_KEY,
      LEGACY_SUBJECT_CODE_STORAGE_KEY,
    );
    const savedDocumentId = migrateStorageKey(
      CURRENT_DOCUMENT_ID_STORAGE_KEY,
      LEGACY_DOCUMENT_ID_STORAGE_KEY,
    );

    if (savedDocumentId) {
      setCatalogFindMode(false);
      return;
    }

    if (savedSubjectCode) {
      let ignore = false;
      fetchSubject(savedSubjectCode)
        .then((subject) => {
          if (!ignore) {
            setCatalogFindMode(false);
            setCurrentSubject(subject);
            setCurrentDocument(undefined);
            setChatSelectionReady(true);
          }
        })
        .catch(() => {
          localStorage.removeItem(CURRENT_SUBJECT_CODE_STORAGE_KEY);
          setCatalogFindMode(true);
          setChatSelectionReady(true);
        });

      return () => { ignore = true; };
    }

    setCatalogFindMode(true);
    setChatSelectionReady(true);
  }, []);

  useEffect(() => {
    try {
      if (currentDocument?.id) {
        localStorage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, currentDocument.id);
      } else {
        localStorage.removeItem(CURRENT_DOCUMENT_ID_STORAGE_KEY);
      }
    } catch { /* ignore storage failures */ }
  }, [currentDocument]);

  useEffect(() => {
    try {
      if (currentSubject?.subjectCode) {
        localStorage.setItem(CURRENT_SUBJECT_CODE_STORAGE_KEY, currentSubject.subjectCode);
      } else {
        localStorage.removeItem(CURRENT_SUBJECT_CODE_STORAGE_KEY);
      }
    } catch { /* ignore storage failures */ }
  }, [currentSubject]);

  useEffect(() => {
    try {
      if (catalogFindMode) {
        localStorage.setItem(CATALOG_FIND_MODE_STORAGE_KEY, "1");
      } else {
        localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
      }
    } catch { /* ignore storage failures */ }
  }, [catalogFindMode]);

  useEffect(() => {
    if (!isUserLoggedIn || !pendingDocumentsKey) return;

    let ignore = false;
    let inFlight = false;

    const pollDocumentStatuses = async () => {
      if (inFlight) return;
      inFlight = true;

      const pendingDocuments = documentsRef.current.filter((doc) =>
        PENDING_INDEX_STATUSES.has(doc.indexStatus ?? "unknown"),
      );

      try {
        const updates = await Promise.all(
          pendingDocuments.map(async (doc) => {
            try {
              const response = await fetch(
                `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/documents/${encodeURIComponent(doc.id)}/status`,
                { headers: getAuthHeaders() },
              );
              const data: DocumentStatusResponse = await response.json();
              if (!response.ok || data.status !== 200) return null;
              return data;
            } catch {
              return null;
            }
          }),
        );

        if (ignore) return;

        const validUpdates = updates.filter(
          (update): update is DocumentStatusResponse => !!update?.documentId,
        );
        if (validUpdates.length === 0) return;

        await refreshUser();

        setDocuments((prev) => {
          let changed = false;
          const nextDocuments = prev.map((doc) => {
            const update = validUpdates.find((item) => item.documentId === doc.id);
            if (!update) return doc;

            const nextDocument = update.document ?? { ...doc, indexStatus: update.indexStatus ?? doc.indexStatus };
            if (
              nextDocument.indexStatus !== doc.indexStatus ||
              nextDocument.tokenCount !== doc.tokenCount ||
              nextDocument.summary !== doc.summary ||
              nextDocument.pageCount !== doc.pageCount
            ) {
              changed = true;
            }
            return nextDocument;
          });

          if (!changed) return prev;

          setCurrentDocument((current) => {
            if (!current) return current;
            return nextDocuments.find((doc) => doc.id === current.id) ?? current;
          });

          return nextDocuments;
        });
      } finally {
        inFlight = false;
      }
    };

    pollDocumentStatuses();
    const intervalId = window.setInterval(pollDocumentStatuses, INDEX_STATUS_POLL_INTERVAL_MS);
    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [isUserLoggedIn, pendingDocumentsKey, refreshUser]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!hasTokens) {
        showAlert("Token balance exhausted.", "error");
        return;
      }
      if (!hasPages) {
        showAlert("Page credits exhausted.", "error");
        return;
      }
      setUploadProgress(true);
      try {
        const validation = await validateFile(acceptedFiles[0]);
        if (!validation.success) {
          showAlert(validation.message ?? "Failed to upload document", "error");
          return;
        }
        const filePageCount = validation.pageCount ?? 0;
        if (filePageCount > availablePageCount) {
          showAlert(
            `Not enough page credits (need ${filePageCount}, have ${availablePageCount}).`,
            "error"
          );
          return;
        }
        const formData = new FormData();
        formData.append("file", acceptedFiles[0]);
        formData.append("model_provider", selectedModel);
        const response = await fetch(`${BACKEND_API_URL}${PAPERAI_API_PREFIX}/upload`, {
          method: "POST",
          body: formData,
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          showAlert(await readErrorMessage(response, "Failed to upload document"), "error");
          return;
        }
        const data = await response.json();
        setSummary(data.summary ?? "");
        if (typeof data.available_page_count === "number") {
          setAvailablePageCount(data.available_page_count);
        }
        await refreshUser();
        const fetchedDocuments = await fetchDocuments();
        const uploaded = fetchedDocuments.find((d) => d.id === data.documentId);
        if (uploaded) {
          localStorage.removeItem(CURRENT_SUBJECT_CODE_STORAGE_KEY);
          localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
          localStorage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, uploaded.id);
          setCatalogFindMode(false);
          setCurrentSubject(undefined);
          setCurrentDocument(uploaded);
        }
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "Failed to upload document", "error");
      } finally {
        setUploadProgress(false);
      }
    },
    [selectedModel, fetchDocuments, showAlert, hasTokens, hasPages, availablePageCount, refreshUser],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    disabled: uploadProgress || !canUpload,
    onDrop,
  });

  const handleCatalogFindSelect = () => {
    localStorage.removeItem(CURRENT_DOCUMENT_ID_STORAGE_KEY);
    localStorage.removeItem(CURRENT_SUBJECT_CODE_STORAGE_KEY);
    setCatalogFindMode(true);
    setCurrentSubject(undefined);
    setCurrentDocument(undefined);
    setSummary("");
  };

  const handleSubjectSelect = async (subjectCode: string) => {
    try {
      localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
      localStorage.removeItem(CURRENT_DOCUMENT_ID_STORAGE_KEY);
      localStorage.setItem(CURRENT_SUBJECT_CODE_STORAGE_KEY, subjectCode);
      setCatalogFindMode(false);
      const subject = await fetchSubject(subjectCode);
      setCurrentSubject(subject);
      setCurrentDocument(undefined);
      setSummary("");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to load subject", "error");
    }
  };

  const handleDocumentSelect = (documentId: string) => {
    const doc = documents.find((item) => item.id === documentId);
    if (doc) {
      localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
      localStorage.removeItem(CURRENT_SUBJECT_CODE_STORAGE_KEY);
      localStorage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, doc.id);
      setCatalogFindMode(false);
      setCurrentSubject(undefined);
      setCurrentDocument(doc);
      setSummary(doc.summary ?? "");
    }
  };

  const handleDocumentDelete = async (documentId: string) => {
    const documentToDelete = documents.find((item) => item.id === documentId);
    if (!documentToDelete || deletingDocumentId) return;

    const confirmed = window.confirm(
      `Delete "${documentToDelete.filename}" and all chat history for this document?`,
    );
    if (!confirmed) return;

    try {
      setDeletingDocumentId(documentId);
      const response = await fetch(
        `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/documents/${encodeURIComponent(documentId)}`,
        { method: "DELETE", headers: getAuthHeaders() },
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        showAlert(data.message || "Failed to delete document", "error");
        return;
      }

      const remainingDocuments = documents.filter((item) => item.id !== documentId);
      setDocuments(remainingDocuments);
      if (currentDocument?.id === documentId) {
        const nextDocument = remainingDocuments[0];
        setCurrentDocument(nextDocument);
        setSummary(nextDocument?.summary ?? "");
      }
      showAlert("Document deleted", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to delete document", "error");
    } finally {
      setDeletingDocumentId(undefined);
    }
  };

  const handlePdfViewerClose = () => {
    setPdfViewerDocument(undefined);
    setPdfViewerUrl(undefined);
    setPdfViewerError(undefined);
    setPdfViewerLoading(false);
  };

  const handleViewPdf = useCallback(
    async (document: DocumentMetaData) => {
      setPdfViewerDocument(document);
      setPdfViewerUrl(undefined);
      setPdfViewerError(undefined);
      setPdfViewerLoading(true);

      try {
        const response = await fetch(
          `${BACKEND_API_URL}${PAPERAI_API_PREFIX}/documents/${encodeURIComponent(document.id)}/pdf-url`,
          { headers: getAuthHeaders() },
        );
        const data: PdfUrlResponse = await response.json();

        if (!response.ok || data.status !== 200 || !data.url) {
          const message = data.message || "Failed to open PDF";
          setPdfViewerError(message);
          showAlert(message, "error");
          return;
        }

        setPdfViewerUrl(data.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open PDF";
        setPdfViewerError(message);
        showAlert(message, "error");
      } finally {
        setPdfViewerLoading(false);
      }
    },
    [showAlert],
  );

  const handleBuyTokens = async (tokenCount: number) => {
    try {
      setBuyingTokens(true);
      const response = await fetch(`${BACKEND_API_URL}/payment/create-order`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token_count: tokenCount }),
      });
      if (!response.ok) {
        showAlert(await readErrorMessage(response, "Failed to buy tokens"), "error");
        return;
      }
      const data = await response.json();
      const { amount, key_id , currency , notes , order_id  } = data;

      await loadRazorpayScript();

      const options = {
        key: key_id,
        amount,
        currency,
        name: "paperAI",
        description: "Payment for tokens",
        order_id,
        notes,
        prefill: {
          name: user?.name,
          email: user?.email,
        },
      };

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay!({
          ...options,
          handler: function (response) {
            resolve({
              success: true,
              response,
            });
          },
          modal: {
            ondismiss: function () {
              reject(new Error("Payment cancelled"));
            },
          },
        });

        rzp.on("payment.failed", function (response) {
          reject(new Error(response.error.description));
        });

        rzp.open();
      });

      
    // wait till the rzp is closed
      setIsBuyTokenOpen(false);
      // refresh the user
      await refreshUser();
      showAlert("Token order created successfully", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to buy tokens", "error");
    } finally {
      setBuyingTokens(false);
    }
  };

  return (
    <div
      className="font-instrument"
      style={{ backgroundColor: "var(--ed-bg)", color: "var(--ed-ink)", minHeight: "100vh" }}
    >
      <BuyTokenDialog
        open={isBuyTokenOpen}
        buying={buyingTokens}
        onClose={() => setIsBuyTokenOpen(false)}
        onBuy={handleBuyTokens}
      />
      <LogoutConfirmDialog
        open={isLogoutConfirmOpen}
        signingOut={signingOut}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
      <PdfViewerDialog
        open={!!pdfViewerDocument}
        filename={pdfViewerDocument?.filename}
        url={pdfViewerUrl}
        loading={pdfViewerLoading}
        error={pdfViewerError}
        onClose={handlePdfViewerClose}
        onRetry={pdfViewerDocument ? () => handleViewPdf(pdfViewerDocument) : undefined}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          backgroundColor: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--ed-rule)",
        }}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16">
          <span
            className="font-fraunces cursor-pointer"
            style={{ fontWeight: 300, fontStyle: "italic", fontSize: "1.375rem", letterSpacing: "-0.02em" }}
            onClick={() => router.push("/")}
          >
            paperAI
          </span>

          <div className="flex items-center gap-1 sm:gap-2">
            <div
              title="Buy tokens"
              className={`flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer hover:bg-gray-100 rounded-md border border-[var(--ed-rule)] ${hasTokens ? "text-[var(--ed-muted)]" : "text-[var(--ed-accent)]"  }`}
              onClick={() => setIsBuyTokenOpen(true)}
            >
              <Coins size={14} />
              <span>Buy tokens</span>
            </div>
            <div
              title="Available tokens"
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-[var(--ed-rule)] ${hasTokens ? "text-[var(--ed-accent)]" : "text-[#b42318]"  }`}
            >
              <Coins size={14} />
              <span>{tokenLabel}</span>
            </div>
            <div
              title="Available page credits"
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-[var(--ed-rule)] ${hasPages ? "text-[var(--ed-accent)]" : "text-[#b42318]"  }`}
            >
              <FileText size={14} />
              <span>{pageLabel} pages</span>
            </div>


            {/* <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as AIModel)}>
              <SelectTrigger
                className="h-8 border-0 shadow-none bg-transparent text-xs focus:ring-0 font-instrument w-[120px] sm:w-[130px]"
                style={{ color: "var(--ed-muted)", borderBottom: "1px solid var(--ed-rule)", borderRadius: 0 }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini AI</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select> */}

            <div style={{ width: 1, height: 20, backgroundColor: "var(--ed-rule)", margin: "0 4px" }} />

            <button
              onClick={userProfile}
              title="Profile"
              className="flex items-center justify-center p-1.5 rounded transition-colors"
              style={{ color: "var(--ed-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ed-ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ed-muted)")}
            >
              <UserCircle size={18} />
            </button>
            <button
              onClick={handleLogoutClick}
              title="Sign out"
              className="flex items-center justify-center p-1.5 rounded transition-colors"
              style={{ color: "var(--ed-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ed-ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ed-muted)")}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-5 sm:py-6 lg:h-[calc(100vh-4.25rem)] lg:min-h-0 lg:overflow-hidden">
        <input {...getInputProps()} style={{ display: "none" }} />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-5 lg:gap-6 items-start lg:items-stretch h-full lg:min-h-0">

          {/* Left column */}
          <div className="flex flex-col gap-4 min-h-0 h-full lg:overflow-hidden">

            {showFindMaterialsHeader ? (
              <div
                className="animate-fade-up ed-panel shrink-0"
                style={{
                  animationDelay: "0ms",
                  padding: "0.875rem 1.25rem",
                  backgroundColor: "var(--ed-surface)",
                }}
              >
                <h2
                  className="font-fraunces"
                  style={{ fontWeight: 300, fontStyle: "italic", fontSize: "1.125rem", marginBottom: "0.25rem" }}
                >
                  Find materials
                </h2>
                <p style={{ fontSize: "0.8125rem", color: "var(--ed-muted)", lineHeight: 1.6 }}>
                  Search books, syllabus, and exam papers across all GTU subjects.
                  For textbook explanations, pick a subject from the sidebar.
                </p>
              </div>
            ) : currentSubject ? (
              <div
                className="animate-fade-up ed-panel shrink-0"
                style={{
                  animationDelay: "0ms",
                  padding: "0.875rem 1.25rem",
                  backgroundColor: "var(--ed-surface)",
                }}
              >
                <h2
                  className="font-fraunces"
                  style={{ fontWeight: 300, fontStyle: "italic", fontSize: "1.125rem", marginBottom: "0.25rem" }}
                >
                  {currentSubject.subjectName}
                </h2>
                <p style={{ fontSize: "0.8125rem", color: "var(--ed-muted)", marginBottom: "0.5rem" }}>
                  {currentSubject.subjectCode}
                  {currentSubject.knownAs ? ` · ${currentSubject.knownAs}` : ""}
                  {/* {" · "} */}
                  {/* {currentSubject.indexedBookCount ?? 0}/{currentSubject.bookCount ?? 0} books indexed */}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem 0.75rem" }}>
                  {currentSubject.syllabus ? (
                    <a
                      href={currentSubject.syllabus}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.8125rem", color: "var(--ed-accent)", textDecoration: "underline" }}
                    >
                      Syllabus
                    </a>
                  ) : null}
                  {currentSubject.paperSolution ? (
                    <a
                      href={currentSubject.paperSolution}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.8125rem", color: "var(--ed-accent)", textDecoration: "underline" }}
                    >
                      Paper solutions
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-xs text-muted-foreground mr-1">Old Papers:</span>
                  {(currentSubject.oldPaper ?? []).map((paper) => (
                    <a
                      key={`${paper.year}-${paper.link}`}
                      href={paper.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.8125rem", color: "var(--ed-muted)", textDecoration: "underline" }}
                    >
                        {paper.year}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
            /* Upload zone */
            <div className="animate-fade-up shrink-0" style={{ animationDelay: "0ms" }}>
              <div
                {...(UPLOAD_COMING_SOON ? {} : getRootProps())}
                style={{
                  border: `1px dashed ${!UPLOAD_COMING_SOON && isDragActive ? "var(--ed-accent)" : "var(--ed-rule)"}`,
                  backgroundColor: !UPLOAD_COMING_SOON && isDragActive ? "#eef3ff" : "var(--ed-surface)",
                  borderRadius: 2,
                  padding: "2.25rem 1.5rem",
                  textAlign: "center",
                  cursor: uploadProgress || !canUpload ? "default" : "pointer",
                  opacity: UPLOAD_COMING_SOON ? 1 : canUpload ? 1 : 0.6,
                  transition: "border-color 0.2s, background-color 0.2s",
                }}
              >
                {UPLOAD_COMING_SOON ? (
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        minHeight: 22,
                        padding: "0 0.5rem",
                        marginBottom: "0.65rem",
                        border: "1px solid #c9d8ff",
                        borderRadius: 2,
                        backgroundColor: "#eef3ff",
                        color: "#1a56db",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Coming soon
                    </span>
                    <p style={{ fontSize: "0.875rem", color: "var(--ed-muted)", marginBottom: "0.2rem" }}>
                      PDF upload is not available yet
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--ed-faint)" }}>
                      Use Find materials to browse GTU papers, books, and syllabus
                    </p>
                  </div>
                ) : uploadProgress ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--ed-muted)" }}>
                    <Loader2 size={15} className="animate-spin" />
                    <span style={{ fontSize: "0.875rem" }}>Processing document…</span>
                  </div>
                ) : !canUpload ? (
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "#b42318", marginBottom: "0.2rem" }}>
                      {!hasTokens ? "Token balance exhausted" : "Page credits exhausted"}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--ed-faint)" }}>
                      {!hasTokens ? "Add tokens to upload more PDFs" : "Buy more credits to upload PDFs"}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: "0.875rem", color: "var(--ed-muted)", marginBottom: "0.2rem" }}>
                      Drop a PDF here, or{" "}
                      <span style={{ color: "var(--ed-accent)", textDecoration: "underline", textUnderlineOffset: 3 }}>
                        browse files
                      </span>
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--ed-faint)" }}>PDF files only</p>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Summary */}
            {summary && (
              <div
                className="animate-fade-up shrink-0"
                style={{ animationDelay: "80ms", borderTop: "1px solid var(--ed-rule)", paddingTop: "1.5rem" }}
              >
                <h2
                  className="font-fraunces"
                  style={{ fontWeight: 300, fontStyle: "italic", fontSize: "1.125rem", marginBottom: "0.75rem" }}
                >
                  Summary
                </h2>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.75, color: "#3a3834" }}>
                  {summary}
                </p>
              </div>
            )}

            {/* Chat */}
            <div
              className="animate-fade-up flex flex-col min-h-0 overflow-hidden h-[min(58vh,560px)] lg:h-auto lg:flex-1"
              style={{ animationDelay: "160ms" }}
            >
              <ChatInterFace
                currentDocument={currentDocument}
                currentSubject={currentSubject}
                catalogFindMode={effectiveCatalogFindMode}
                selectedModel={selectedModel}
                availableTokenCount={availableTokenCount}
                onTokenBalanceChange={setAvailableTokenCount}
                onRefreshUser={refreshUser}
                onViewPdf={handleViewPdf}
                onSelectSubject={handleSubjectSelect}
              />
            </div>
          </div>

          {/* Right column – subjects + uploads */}
          <div
            className="animate-fade-up flex flex-col gap-3 h-full min-h-0 w-full"
            style={{ animationDelay: "100ms" }}
          >
            <button
              type="button"
              onClick={handleCatalogFindSelect}
              className="ed-panel w-full text-left transition-colors"
              style={{
                padding: "0.75rem 1rem",
                backgroundColor: isFindMaterialsActive ? "var(--ed-accent)" : "var(--ed-surface)",
                color: isFindMaterialsActive ? "#ffffff" : "var(--ed-ink)",
                border: isFindMaterialsActive ? "none" : "1px solid var(--ed-rule)",
              }}
            >
              <span className="font-fraunces" style={{ fontWeight: 300, fontStyle: "italic", fontSize: "1.05rem" }}>
                Find materials
              </span>
              <p
                style={{
                  fontSize: "0.75rem",
                  marginTop: "0.2rem",
                  color: isFindMaterialsActive ? "rgba(255,255,255,0.85)" : "var(--ed-muted)",
                }}
              >
                Books, papers &amp; syllabus across all subjects
              </p>
            </button>
            <SubjectCatalog
              subjects={subjects}
              loading={subjectsLoading}
              currentSubjectCode={currentSubject?.subjectCode}
              subjectDetail={currentSubject}
              onSelect={handleSubjectSelect}
            />
            <DocumentHistory
              documents={documents}
              onSelect={handleDocumentSelect}
              onDelete={handleDocumentDelete}
              onViewPdf={handleViewPdf}
              onUpload={UPLOAD_COMING_SOON ? undefined : open}
              uploading={uploadProgress}
              uploadDisabled={uploadProgress || !canUpload}
              uploadComingSoon={UPLOAD_COMING_SOON}
              currentId={currentDocument?.id}
              deletingId={deletingDocumentId}
              loading={documentsLoading}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
