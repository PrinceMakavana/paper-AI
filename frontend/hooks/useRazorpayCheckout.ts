"use client";

import { useCallback, useState } from "react";
import { loadRazorpayScript } from "@/lib/razorpay";
import { useCreateOrderMutation } from "@/storage/services/paymentApi";
import type { AuthUser } from "@/storage/services/authApi";

export function useRazorpayCheckout(
  user: AuthUser | null | undefined,
  refreshUser: () => Promise<void>,
) {
  const [createOrder] = useCreateOrderMutation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const checkout = useCallback(
    async (tokenCount: number) => {
      setIsCheckingOut(true);
      try {
        const data = await createOrder({ token_count: tokenCount }).unwrap();
        const { amount, key_id, currency, notes, order_id } = data;

        await loadRazorpayScript();

        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay!({
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
            handler: () => resolve(),
            modal: {
              ondismiss: () => reject(new Error("Payment cancelled")),
            },
          });

          rzp.on("payment.failed", (response: { error: { description: string } }) => {
            reject(new Error(response.error.description));
          });

          rzp.open();
        });

        await refreshUser();
        return true;
      } finally {
        setIsCheckingOut(false);
      }
    },
    [createOrder, refreshUser, user?.email, user?.name],
  );

  return { checkout, isCheckingOut };
}
