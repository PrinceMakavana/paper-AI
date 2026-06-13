"use client";

import { Loader2, Minus, Plus, X } from "lucide-react";
import { useState } from "react";

const TOKENS_PER_RUPEE = 500;
const MIN_INR_PURCHASE = 100;
const INR_STEP = 100;
const INR_PRESETS = [100, 200, 500, 1000];

function tokensForInr(inr: number) {
  return inr * TOKENS_PER_RUPEE;
}

interface BuyTokenDialogProps {
  open: boolean;
  buying: boolean;
  onClose: () => void;
  onBuy: (tokenCount: number) => void;
}

export function BuyTokenDialog({ open, buying, onClose, onBuy }: BuyTokenDialogProps) {
  const [selectedInr, setSelectedInr] = useState(MIN_INR_PURCHASE);

  if (!open) return null;

  const selectedTokenCount = tokensForInr(selectedInr);
  const canBuySelectedTokens =
    Number.isInteger(selectedInr) && selectedInr >= MIN_INR_PURCHASE;

  const updateSelectedInr = (value: number) => {
    if (!Number.isFinite(value)) {
      setSelectedInr(MIN_INR_PURCHASE);
      return;
    }
    setSelectedInr(Math.max(0, Math.floor(value)));
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
              ₹1 = {TOKENS_PER_RUPEE.toLocaleString()} tokens · min ₹{MIN_INR_PURCHASE.toLocaleString("en-IN")}
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
            {INR_PRESETS.map((inr) => {
              const tokenCount = tokensForInr(inr);
              const isSelected = selectedInr === inr;

              return (
                <button
                  key={inr}
                  type="button"
                  onClick={() => setSelectedInr(inr)}
                  className="px-3 py-3 text-left transition-colors"
                  style={{
                    border: `1px solid ${isSelected ? "var(--ed-accent)" : "var(--ed-rule)"}`,
                    borderRadius: 6,
                    backgroundColor: isSelected ? "#eef3ff" : "var(--ed-surface)",
                  }}
                >
                  <span style={{ display: "block", fontSize: "1.05rem", color: "var(--ed-ink)", fontWeight: 600 }}>
                    ₹ {inr.toLocaleString("en-IN")}
                  </span>
                  <span style={{ display: "block", fontSize: "0.72rem", color: "var(--ed-muted)", marginTop: 4 }}>
                    Token: {tokenCount.toLocaleString("en-IN")}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <label
              htmlFor="purchase-amount"
              style={{ display: "block", fontSize: "0.78rem", color: "var(--ed-muted)", marginBottom: 8 }}
            >
              Custom amount (₹)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Decrease amount"
                onClick={() => updateSelectedInr(selectedInr - INR_STEP)}
                disabled={buying || selectedInr <= MIN_INR_PURCHASE}
                className="flex h-10 w-10 items-center justify-center rounded-md border transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-45"
                style={{ borderColor: "var(--ed-rule)", color: "var(--ed-muted)" }}
              >
                <Minus size={16} />
              </button>
              <input
                id="purchase-amount"
                type="number"
                min={MIN_INR_PURCHASE}
                step={INR_STEP}
                value={selectedInr}
                onChange={(event) => updateSelectedInr(Number(event.target.value))}
                className="h-10 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                style={{ borderColor: "var(--ed-rule)", color: "var(--ed-ink)" }}
              />
              <button
                type="button"
                title="Increase amount"
                onClick={() => updateSelectedInr(selectedInr + INR_STEP)}
                disabled={buying}
                className="flex h-10 w-10 items-center justify-center rounded-md border transition-colors hover:bg-gray-100 disabled:opacity-45"
                style={{ borderColor: "var(--ed-rule)", color: "var(--ed-muted)" }}
              >
                <Plus size={16} />
              </button>
            </div>
            {!canBuySelectedTokens && (
              <p style={{ color: "#b42318", fontSize: "0.76rem", marginTop: 8 }}>
                Please select at least ₹{MIN_INR_PURCHASE.toLocaleString("en-IN")}.
              </p>
            )}
          </div>

          <div
            className="mt-5 px-3 py-3"
            style={{ backgroundColor: "var(--ed-surface)", border: "1px solid var(--ed-rule)", borderRadius: 6 }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: "0.82rem", color: "var(--ed-muted)" }}>Amount</span>
              <span style={{ fontSize: "1rem", color: "var(--ed-ink)", fontWeight: 600 }}>
                ₹ {selectedInr.toLocaleString("en-IN")}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--ed-muted)" }}>
              <span>Token: {selectedTokenCount.toLocaleString("en-IN")}</span>
            </div>
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
