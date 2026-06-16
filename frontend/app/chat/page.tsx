"use client";

import { ChatInterFace } from "@/components/chat-interface";
import { BuyTokenDialog } from "@/components/buy-token-dialog";
import { LogoutConfirmDialog } from "@/components/logout-confirm-dialog";
import { DocumentHistory } from "@/components/document-history";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { SubjectCatalog } from "@/components/subject-catalog";
import { DocumentMetaData } from "@/lib/types";
import { Coins, Loader2, LogOut, UserCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAlert } from "@/components/context/alert/alert-context";
import { useAuth } from "@/components/context/auth/auth-context";
import { validateFile } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useGetSubjectsQuery } from "@/storage/services/catalogApi";
import {
  useDeleteDocumentMutation,
  useGetDocumentsQuery,
  useLazyGetDocumentPdfUrlQuery,
  useUploadDocumentMutation,
} from "@/storage/services/paperaiApi";
import { useChatSelection } from "@/hooks/useChatSelection";
import { useDocumentStatusPolling } from "@/hooks/useDocumentStatusPolling";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

const UPLOAD_COMING_SOON = true;

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string; error?: string } }).data;
    return data?.message || data?.error || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function ChatPage() {
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | undefined>();
  const selectedModel = "gemini";
  const { isUserLoggedIn, user, refreshUser, logout } = useAuth();
  const { showAlert } = useAlert();
  const [availableTokenCount, setAvailableTokenCount] = useState(0);
  const [availablePageCount, setAvailablePageCount] = useState(0);
  const [isBuyTokenOpen, setIsBuyTokenOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pdfViewerDocument, setPdfViewerDocument] = useState<DocumentMetaData | undefined>();
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | undefined>();
  const [pdfViewerLoading, setPdfViewerLoading] = useState(false);
  const [pdfViewerError, setPdfViewerError] = useState<string | undefined>();

  const {
    data: documents = [],
    isLoading: documentsLoading,
    isError: documentsError,
    error: documentsQueryError,
    refetch: refetchDocuments,
  } = useGetDocumentsQuery(undefined, { skip: !isUserLoggedIn });

  const {
    data: subjects = [],
    isLoading: subjectsLoading,
    isError: subjectsError,
    error: subjectsQueryError,
  } = useGetSubjectsQuery(undefined, { skip: !isUserLoggedIn });

  const [uploadDocument] = useUploadDocumentMutation();
  const [deleteDocument] = useDeleteDocumentMutation();
  const [fetchPdfUrl] = useLazyGetDocumentPdfUrlQuery();
  const { checkout, isCheckingOut: buyingTokens } = useRazorpayCheckout(user, refreshUser);

  const {
    currentDocument,
    currentSubject,
    summary,
    setSummary,
    setCurrentDocument,
    handleCatalogFindSelect,
    handleSubjectSelect,
    handleDocumentSelect,
    showFindMaterialsHeader,
    isFindMaterialsActive,
    effectiveCatalogFindMode,
  } = useChatSelection(documents, !documentsLoading && !documentsError);

  useDocumentStatusPolling(
    documents,
    isUserLoggedIn,
    refreshUser,
    setCurrentDocument,
  );

  const hasTokens = availableTokenCount > 0;
  const hasPages = availablePageCount > 0;
  const canUpload = !UPLOAD_COMING_SOON && hasTokens && hasPages;
  const tokenLabel = new Intl.NumberFormat(undefined, {
    notation: availableTokenCount >= 1000 ? "compact" : "standard",
    maximumFractionDigits: availableTokenCount >= 1000 ? 1 : 0,
  }).format(Math.max(availableTokenCount, 0));

  useEffect(() => {
    if (!isUserLoggedIn) {
      router.push("/login");
    }
  }, [isUserLoggedIn, router]);

  useEffect(() => {
    if (documentsError) {
      showAlert(getApiErrorMessage(documentsQueryError, "Failed to load documents"), "error");
    }
  }, [documentsError, documentsQueryError, showAlert]);

  useEffect(() => {
    if (subjectsError) {
      showAlert(getApiErrorMessage(subjectsQueryError, "Failed to load subjects"), "error");
    }
  }, [subjectsError, subjectsQueryError, showAlert]);

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

  const userProfile = () => {
    router.push("/profile");
  };

  useEffect(() => {
    setAvailableTokenCount(Number(user?.available_token_count ?? 0));
    setAvailablePageCount(Number(user?.available_page_count ?? 0));
  }, [user?.available_token_count, user?.available_page_count]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!hasTokens) {
        showAlert("Token balance exhausted.", "error");
        return;
      }
      if (!hasPages) {
        showAlert("Insufficient balance.", "error");
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
          showAlert("Insufficient balance for this file.", "error");
          return;
        }

        const data = await uploadDocument({
          file: acceptedFiles[0],
          modelProvider: selectedModel,
        }).unwrap();

        setSummary(data.summary ?? "");
        if (typeof data.available_page_count === "number") {
          setAvailablePageCount(data.available_page_count);
        }
        await refreshUser();
        const { data: refreshedDocuments = [] } = await refetchDocuments();
        const uploaded = refreshedDocuments.find((d) => d.id === data.documentId);
        if (uploaded) {
          handleDocumentSelect(uploaded.id);
        }
      } catch (error) {
        showAlert(getApiErrorMessage(error, "Failed to upload document"), "error");
      } finally {
        setUploadProgress(false);
      }
    },
    [
      availablePageCount,
      handleDocumentSelect,
      hasPages,
      hasTokens,
      refetchDocuments,
      refreshUser,
      selectedModel,
      setSummary,
      showAlert,
      uploadDocument,
    ],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    disabled: uploadProgress || !canUpload,
    onDrop,
  });

  const handleDocumentDelete = async (documentId: string) => {
    const documentToDelete = documents.find((item) => item.id === documentId);
    if (!documentToDelete || deletingDocumentId) return;

    const confirmed = window.confirm(
      `Delete "${documentToDelete.filename}" and all chat history for this document?`,
    );
    if (!confirmed) return;

    try {
      setDeletingDocumentId(documentId);
      const data = await deleteDocument(documentId).unwrap();
      if (data.status !== 200) {
        showAlert(data.message || "Failed to delete document", "error");
        return;
      }

      if (currentDocument?.id === documentId) {
        const remainingDocuments = documents.filter((item) => item.id !== documentId);
        const nextDocument = remainingDocuments[0];
        setCurrentDocument(nextDocument);
        setSummary(nextDocument?.summary ?? "");
      }
      showAlert("Document deleted", "success");
    } catch (error) {
      showAlert(getApiErrorMessage(error, "Failed to delete document"), "error");
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
        const data = await fetchPdfUrl(document.id).unwrap();
        if (data.status !== 200 || !data.url) {
          const message = data.message || "Failed to open PDF";
          setPdfViewerError(message);
          showAlert(message, "error");
          return;
        }
        setPdfViewerUrl(data.url);
      } catch (error) {
        const message = getApiErrorMessage(error, "Failed to open PDF");
        setPdfViewerError(message);
        showAlert(message, "error");
      } finally {
        setPdfViewerLoading(false);
      }
    },
    [fetchPdfUrl, showAlert],
  );

  const handleBuyTokens = async (tokenCount: number) => {
    try {
      await checkout(tokenCount);
      setIsBuyTokenOpen(false);
      showAlert("Token order created successfully", "success");
    } catch (error) {
      showAlert(getApiErrorMessage(error, "Failed to buy tokens"), "error");
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
                      Token balance exhausted
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--ed-faint)" }}>
                      Add tokens to upload PDFs
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
