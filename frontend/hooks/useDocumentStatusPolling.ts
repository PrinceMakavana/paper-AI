"use client";

import { useEffect, useMemo, useRef } from "react";
import { paperaiApi, useLazyGetDocumentStatusQuery } from "@/storage/services/paperaiApi";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import type { DocumentMetaData } from "@/lib/types";
import type { DocumentStatusResponse } from "@/storage/types/paperai";

const INDEX_STATUS_POLL_INTERVAL_MS = 10000;
const PENDING_INDEX_STATUSES = new Set(["queued", "running", "unknown"]);

export function useDocumentStatusPolling(
  documents: DocumentMetaData[],
  enabled: boolean,
  refreshUser: () => Promise<void>,
  setCurrentDocument: React.Dispatch<React.SetStateAction<DocumentMetaData | undefined>>,
) {
  const dispatch = useAppDispatch();
  const [triggerStatus] = useLazyGetDocumentStatusQuery();
  const documentsRef = useRef(documents);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

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
    if (!enabled || !pendingDocumentsKey) return;

    let ignore = false;
    let inFlight = false;

    const applyUpdates = (validUpdates: DocumentStatusResponse[]) => {
      dispatch(
        paperaiApi.util.updateQueryData("getDocuments", undefined, (draft) => {
          for (const update of validUpdates) {
            if (!update.documentId) continue;
            const index = draft.findIndex((doc) => doc.id === update.documentId);
            if (index === -1) continue;

            const doc = draft[index];
            draft[index] =
              update.document ?? { ...doc, indexStatus: update.indexStatus ?? doc.indexStatus };
          }
        }),
      );

      setCurrentDocument((current) => {
        if (!current) return current;
        const update = validUpdates.find((item) => item.documentId === current.id);
        if (!update) return current;
        return update.document ?? { ...current, indexStatus: update.indexStatus ?? current.indexStatus };
      });
    };

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
              const data = await triggerStatus(doc.id).unwrap();
              if (data.status !== 200) return null;
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
        applyUpdates(validUpdates);
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
  }, [
    dispatch,
    enabled,
    pendingDocumentsKey,
    refreshUser,
    setCurrentDocument,
    triggerStatus,
  ]);
}
