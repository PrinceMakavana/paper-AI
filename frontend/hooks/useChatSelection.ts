"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAlert } from "@/components/context/alert/alert-context";
import { useLazyGetSubjectQuery } from "@/storage/services/catalogApi";
import type { DocumentMetaData, SubjectDetail } from "@/lib/types";

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

export function useChatSelection(
  documents: DocumentMetaData[],
  documentsLoaded: boolean,
) {
  const [currentDocument, setCurrentDocument] = useState<DocumentMetaData | undefined>();
  const [currentSubject, setCurrentSubject] = useState<SubjectDetail | undefined>();
  const [catalogFindMode, setCatalogFindMode] = useState(false);
  const [chatSelectionReady, setChatSelectionReady] = useState(false);
  const [summary, setSummary] = useState("");
  const [lazyGetSubject] = useLazyGetSubjectQuery();
  const { showAlert } = useAlert();
  const mountInitDone = useRef(false);

  useEffect(() => {
    if (!documentsLoaded) return;

    const savedId = migrateStorageKey(
      CURRENT_DOCUMENT_ID_STORAGE_KEY,
      LEGACY_DOCUMENT_ID_STORAGE_KEY,
    );
    if (!savedId) return;

    const match = documents.find((d) => d.id === savedId);
    if (match) {
      localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
      setCatalogFindMode(false);
      setCurrentSubject(undefined);
      setCurrentDocument(match);
      setSummary(match.summary ?? "");
    }
    setChatSelectionReady(true);
  }, [documents, documentsLoaded]);

  useEffect(() => {
    if (mountInitDone.current) return;
    mountInitDone.current = true;

    const savedDocumentId = migrateStorageKey(
      CURRENT_DOCUMENT_ID_STORAGE_KEY,
      LEGACY_DOCUMENT_ID_STORAGE_KEY,
    );
    if (savedDocumentId) {
      setCatalogFindMode(false);
      return;
    }

    const savedSubjectCode = migrateStorageKey(
      CURRENT_SUBJECT_CODE_STORAGE_KEY,
      LEGACY_SUBJECT_CODE_STORAGE_KEY,
    );
    if (savedSubjectCode) {
      let ignore = false;
      lazyGetSubject(savedSubjectCode)
        .unwrap()
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
      return () => {
        ignore = true;
      };
    }

    setCatalogFindMode(true);
    setChatSelectionReady(true);
  }, [lazyGetSubject]);

  useEffect(() => {
    try {
      if (currentDocument?.id) {
        localStorage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, currentDocument.id);
      } else {
        localStorage.removeItem(CURRENT_DOCUMENT_ID_STORAGE_KEY);
      }
    } catch {
      /* ignore storage failures */
    }
  }, [currentDocument]);

  useEffect(() => {
    try {
      if (currentSubject?.subjectCode) {
        localStorage.setItem(CURRENT_SUBJECT_CODE_STORAGE_KEY, currentSubject.subjectCode);
      } else {
        localStorage.removeItem(CURRENT_SUBJECT_CODE_STORAGE_KEY);
      }
    } catch {
      /* ignore storage failures */
    }
  }, [currentSubject]);

  useEffect(() => {
    try {
      if (catalogFindMode) {
        localStorage.setItem(CATALOG_FIND_MODE_STORAGE_KEY, "1");
      } else {
        localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
      }
    } catch {
      /* ignore storage failures */
    }
  }, [catalogFindMode]);

  const handleCatalogFindSelect = useCallback(() => {
    localStorage.removeItem(CURRENT_DOCUMENT_ID_STORAGE_KEY);
    localStorage.removeItem(CURRENT_SUBJECT_CODE_STORAGE_KEY);
    setCatalogFindMode(true);
    setCurrentSubject(undefined);
    setCurrentDocument(undefined);
    setSummary("");
  }, []);

  const handleSubjectSelect = useCallback(
    async (subjectCode: string) => {
      try {
        localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
        localStorage.removeItem(CURRENT_DOCUMENT_ID_STORAGE_KEY);
        localStorage.setItem(CURRENT_SUBJECT_CODE_STORAGE_KEY, subjectCode);
        setCatalogFindMode(false);
        const subject = await lazyGetSubject(subjectCode).unwrap();
        setCurrentSubject(subject);
        setCurrentDocument(undefined);
        setSummary("");
      } catch (error) {
        showAlert(
          error instanceof Error ? error.message : "Failed to load subject",
          "error",
        );
      }
    },
    [lazyGetSubject, showAlert],
  );

  const handleDocumentSelect = useCallback(
    (documentId: string) => {
      const doc = documents.find((item) => item.id === documentId);
      if (!doc) return;

      localStorage.removeItem(CATALOG_FIND_MODE_STORAGE_KEY);
      localStorage.removeItem(CURRENT_SUBJECT_CODE_STORAGE_KEY);
      localStorage.setItem(CURRENT_DOCUMENT_ID_STORAGE_KEY, doc.id);
      setCatalogFindMode(false);
      setCurrentSubject(undefined);
      setCurrentDocument(doc);
      setSummary(doc.summary ?? "");
    },
    [documents],
  );

  const showFindMaterialsHeader =
    !currentSubject && !currentDocument && (catalogFindMode || !chatSelectionReady);
  const isFindMaterialsActive =
    !currentSubject && !currentDocument && (catalogFindMode || !chatSelectionReady);
  const effectiveCatalogFindMode =
    catalogFindMode || (!chatSelectionReady && !currentSubject && !currentDocument);

  return {
    currentDocument,
    currentSubject,
    catalogFindMode,
    chatSelectionReady,
    summary,
    setSummary,
    setCurrentDocument,
    handleCatalogFindSelect,
    handleSubjectSelect,
    handleDocumentSelect,
    showFindMaterialsHeader,
    isFindMaterialsActive,
    effectiveCatalogFindMode,
  };
}
