"use client";

import { Loader2, LogOut, X } from "lucide-react";

interface LogoutConfirmDialogProps {
  open: boolean;
  signingOut: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmDialog({
  open,
  signingOut,
  onClose,
  onConfirm,
}: LogoutConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(17, 17, 17, 0.38)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !signingOut) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-sm animate-fade-up"
        style={{
          backgroundColor: "var(--ed-bg)",
          border: "1px solid var(--ed-rule)",
          borderRadius: 8,
          boxShadow: "0 24px 70px rgba(25, 24, 20, 0.18)",
        }}
      >
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--ed-rule)" }}
        >
          <div>
            <h2
              className="font-fraunces"
              style={{ fontSize: "1.25rem", fontWeight: 300, fontStyle: "italic" }}
            >
              Sign out?
            </h2>
            <p style={{ color: "var(--ed-muted)", fontSize: "0.875rem", marginTop: 6, lineHeight: 1.5 }}>
              You will need to sign in again to access your documents and chat history.
            </p>
          </div>
          <button
            type="button"
            title="Close"
            disabled={signingOut}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 disabled:opacity-50"
            style={{ color: "var(--ed-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button
            type="button"
            disabled={signingOut}
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm transition-colors hover:bg-gray-100 disabled:opacity-50"
            style={{ color: "var(--ed-ink)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={signingOut}
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "var(--ed-ink)" }}
          >
            {signingOut ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut size={14} />
                Sign out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
