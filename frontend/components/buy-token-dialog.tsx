"use client";

import { Loader2, Minus, Plus, X } from "lucide-react";
import { useState } from "react";

const MIN_TOKEN_PURCHASE = 5000;
const TOKEN_STEP = 1000;
const TOKEN_PRICE_PREVIEW_INR_PER_1000 = 20;
const PAGES_PER_1000_TOKENS = 20;
const TOKEN_PRESETS = [5000, 10000, 25000, 50000];

function pagesForTokenCount(tokenCount: number) {
  return (tokenCount / TOKEN_STEP) * PAGES_PER_1000_TOKENS;
}

interface BuyTokenDialogProps {
  open: boolean;
  buying: boolean;
  onClose: () => void;
  onBuy: (tokenCount: number) => void;
}

export function BuyTokenDialog({ open, buying, onClose, onBuy }: BuyTokenDialogProps) {
  const [selectedTokenCount, setSelectedTokenCount] = useState(MIN_TOKEN_PURCHASE);

  if (!open) return null;

  const selectedTokenAmountPreview =
    (selectedTokenCount / TOKEN_STEP) * TOKEN_PRICE_PREVIEW_INR_PER_1000;
  const canBuySelectedTokens =
    Number.isInteger(selectedTokenCount) && selectedTokenCount >= MIN_TOKEN_PURCHASE;

  const updateSelectedTokenCount = (value: number) => {
    if (!Number.isFinite(value)) {
      setSelectedTokenCount(MIN_TOKEN_PURCHASE);
      return;
    }
    setSelectedTokenCount(Math.max(0, Math.floor(value)));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(17, 17, 17, 0.38)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !buying) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md animate-fade-up"
        style={{
          backgroundColor: "var(--ed-bg)",
          border: "1px solid var(--ed-rule)",
          borderRadius: 8,
          boxShadow: "0 24px 70px rgba(25, 24, 20, 0.18)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--ed-rule)" }}
        >
          <div>
            <h2
              className="font-fraunces"
              style={{ fontSize: "1.25rem", fontWeight: 300, fontStyle: "italic" }}
            >
              Buy tokens
            </h2>
            <p style={{ color: "var(--ed-muted)", fontSize: "0.8rem", marginTop: 2 }}>
              ₹1 = 50 tokens + 1 page · min {MIN_TOKEN_PURCHASE.toLocaleString()} tokens
            </p>
          </div>
          <button
            type="button"
            title="Close"
            disabled={buying}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 disabled:opacity-50"
            style={{ color: "var(--ed-muted)" }}
          >
            <X size={17} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="grid grid-cols-2 gap-2">
            {TOKEN_PRESETS.map((tokenCount) => (
              <button
                key={tokenCount}
                type="button"
                onClick={() => setSelectedTokenCount(tokenCount)}
                className="px-3 py-3 text-left transition-colors"
                style={{
                  border: `1px solid ${
                    selectedTokenCount === tokenCount ? "var(--ed-accent)" : "var(--ed-rule)"
                  }`,
                  borderRadius: 6,
                  backgroundColor: selectedTokenCount === tokenCount ? "#eef3ff" : "var(--ed-surface)",
                }}
              >
                <span style={{ display: "block", fontSize: "0.95rem", color: "var(--ed-ink)" }}>
                  {tokenCount.toLocaleString()}
                </span>
                <span style={{ display: "block", fontSize: "0.72rem", color: "var(--ed-muted)" }}>
                  tokens + {pagesForTokenCount(tokenCount).toLocaleString()} pages
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <label
              htmlFor="token-count"
              style={{ display: "block", fontSize: "0.78rem", color: "var(--ed-muted)", marginBottom: 8 }}
            >
              Custom token count
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Decrease tokens"
                onClick={() => updateSelectedTokenCount(selectedTokenCount - TOKEN_STEP)}
                disabled={buying || selectedTokenCount <= MIN_TOKEN_PURCHASE}
                className="flex h-10 w-10 items-center justify-center rounded-md border transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
                style={{ borderColor: "var(--ed-rule)", color: "var(--ed-muted)" }}
              >
                <Minus size={16} />
              </button>
              <input
                id="token-count"
                type="number"
                min={MIN_TOKEN_PURCHASE}
                step={TOKEN_STEP}
                value={selectedTokenCount}
                onChange={(event) => updateSelectedTokenCount(Number(event.target.value))}
                className="h-10 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "var(--ed-rule)", color: "var(--ed-ink)" }}
              />
              <button
                type="button"
                title="Increase tokens"
                onClick={() => updateSelectedTokenCount(selectedTokenCount + TOKEN_STEP)}
                disabled={buying}
                className="flex h-10 w-10 items-center justify-center rounded-md border transition-colors hover:bg-gray-100 disabled:opacity-45"
                style={{ borderColor: "var(--ed-rule)", color: "var(--ed-muted)" }}
              >
                <Plus size={16} />
              </button>
            </div>
            {!canBuySelectedTokens && (
              <p style={{ color: "#b42318", fontSize: "0.76rem", marginTop: 8 }}>
                Please select at least {MIN_TOKEN_PURCHASE.toLocaleString()} tokens.
              </p>
            )}
          </div>

          <div
            className="mt-5 flex items-center justify-between px-3 py-3"
            style={{ backgroundColor: "var(--ed-surface)", border: "1px solid var(--ed-rule)", borderRadius: 6 }}
          >
            <span style={{ fontSize: "0.82rem", color: "var(--ed-muted)" }}>Estimated amount</span>
            <span style={{ fontSize: "1rem", color: "var(--ed-ink)", fontWeight: 600 }}>
              ₹{selectedTokenAmountPreview.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--ed-rule)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={buying}
            className="h-9 px-4 text-sm transition-colors hover:bg-gray-100 disabled:opacity-50"
            style={{ borderRadius: 6, color: "var(--ed-muted)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onBuy(selectedTokenCount)}
            disabled={buying || !canBuySelectedTokens}
            className="inline-flex h-9 items-center gap-2 px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55"
            style={{ borderRadius: 6, backgroundColor: "var(--ed-accent)", color: "white" }}
          >
            {buying && <Loader2 size={15} className="animate-spin" />}
            <span>Buy now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
