"use client";

import { useCallback, useState } from "react";
import { loadRazorpayScript } from "@/lib/razorpay";
import { useCreateProductOrderMutation } from "@/storage/services/paymentApi";

export type ProjectCheckoutInput = {
  productSlug: string;
  productTitle: string;
  name: string;
  email: string;
};

export type ProjectCheckoutResult = {
  orderId: string;
};

export function useProjectCheckout() {
  const [createProductOrder] = useCreateProductOrderMutation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const checkout = useCallback(
    async (input: ProjectCheckoutInput): Promise<ProjectCheckoutResult> => {
      setIsCheckingOut(true);
      try {
        const data = await createProductOrder({
          product_slug: input.productSlug,
          name: input.name,
          email: input.email,
        }).unwrap();

        const { amount, key_id, currency, notes, order_id } = data;

        await loadRazorpayScript();

        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay!({
            key: key_id,
            amount,
            currency,
            name: "paperAI",
            description: input.productTitle,
            order_id,
            notes,
            prefill: {
              name: input.name,
              email: input.email,
            },
            handler: () => resolve(),
            modal: {
              ondismiss: () => reject(new Error("Payment cancelled")),
            },
          });

          rzp.on("payment.failed", (response: { error: { description: string } }) => {
            reject(new Error(response.error.description || "Payment failed"));
          });

          rzp.open();
        });

        return { orderId: order_id };
      } finally {
        setIsCheckingOut(false);
      }
    },
    [createProductOrder],
  );

  return { checkout, isCheckingOut };
}
