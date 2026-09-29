"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/context/auth/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProjectCheckout } from "@/hooks/useProjectCheckout";
import { ROUTES } from "@/lib/landing-links";
import { formatInr } from "@/lib/projects";

type ProjectCheckoutPanelProps = {
  slug: string;
  title: string;
  currentPrice: number;
};

type CheckoutStatus = "idle" | "success" | "cancelled" | "failed";

function getCheckoutErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (typeof data === "string" && data.trim()) return data;
    if (data && typeof data === "object") {
      const record = data as { message?: string; error?: string };
      if (record.message) return record.message;
      if (record.error) return record.error;
    }
  }
  return "Payment failed. Please try again.";
}

export function ProjectCheckoutPanel({
  slug,
  title,
  currentPrice,
}: ProjectCheckoutPanelProps) {
  const pathname = usePathname();
  const { user, isUserLoggedIn } = useAuth();
  const { checkout, isCheckingOut } = useProjectCheckout();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const loginHref = `${ROUTES.login}?next=${encodeURIComponent(pathname || `/projects/${slug}`)}`;
  const registerHref = `${ROUTES.register}?next=${encodeURIComponent(pathname || `/projects/${slug}`)}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("idle");

    if (!isUserLoggedIn || !user?.email) {
      setError("Please log in to purchase this project.");
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    try {
      const result = await checkout({
        productSlug: slug,
        productTitle: title,
        name: trimmedName,
        email: user.email,
      });
      setOrderId(result.orderId);
      setStatus("success");
      setSuccessOpen(true);
    } catch (err) {
      const message = getCheckoutErrorMessage(err);
      if (message.toLowerCase().includes("cancel")) {
        setStatus("cancelled");
        setError("Payment was cancelled. You can try again when ready.");
      } else {
        setStatus("failed");
        setError(message);
      }
    }
  }

  if (!isUserLoggedIn) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div>
          <p className="text-sm font-medium text-foreground">Buy now</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Log in to purchase this project securely with Razorpay. Your account
            email will receive the confirmation receipt.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1" size="lg">
            <Link href={loginHref}>Log in to buy — {formatInr(currentPrice)}</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1" size="lg">
            <Link href={registerHref}>Create account</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
      >
        <div>
          <p className="text-sm font-medium text-foreground">Buy now</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pay securely with Razorpay. Confirmation will be sent to your account
            email.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="buyer-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="buyer-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            disabled={isCheckingOut}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="buyer-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="buyer-email"
            name="email"
            type="email"
            value={user?.email ?? ""}
            readOnly
            disabled
            aria-readonly="true"
          />
        </div>

        {error ? (
          <p
            className={`text-sm ${
              status === "cancelled" ? "text-amber-600 dark:text-amber-400" : "text-destructive"
            }`}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={isCheckingOut}>
          {isCheckingOut ? "Opening checkout…" : `Buy Now — ${formatInr(currentPrice)}`}
        </Button>
      </form>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase successful</DialogTitle>
            <DialogDescription>
              Thanks for buying <span className="font-medium text-foreground">{title}</span>.
              A confirmation email is on its way to {user?.email || "your inbox"}.
              {orderId ? (
                <>
                  {" "}
                  Order ID: <span className="font-mono text-foreground">{orderId}</span>.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            If the email is delayed, check spam. Payment success is already recorded —
            delivery of digital content is fulfilled separately after confirmation.
          </p>
          <Button type="button" onClick={() => setSuccessOpen(false)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
