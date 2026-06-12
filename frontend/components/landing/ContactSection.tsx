"use client";

import { z } from "zod";
import freeEmailDomains from "free-email-domains";
import { Mail, LifeBuoy, Briefcase, Clock } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAlert } from "@/components/context/alert/alert-context";
import { useSubmitContactMutation } from "@/storage/services/contactApi";

const isWorkEmail = (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return false;
  }
  return !freeEmailDomains.includes(domain);
};

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .refine(isWorkEmail, {
      message: "Please use a company or work email address",
    }),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

const INFO = [
  { icon: Mail, title: "Email Support", text: "support@paperai.app" },
  { icon: LifeBuoy, title: "Technical Support", text: "tech@paperai.app" },
  { icon: Briefcase, title: "Business Inquiry", text: "business@paperai.app" },
  { icon: Clock, title: "Response Time", text: "Within 24 hours, Mon – Fri" },
];

type ApiError = { data?: { error?: string; message?: string } };

export function ContactSection() {
  const { showAlert } = useAlert();
  const [submitContact, { isLoading }] = useSubmitContactMutation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim().toLowerCase(),
      subject: String(data.get("subject") ?? "").trim(),
      message: String(data.get("message") ?? "").trim(),
    };

    const validation = contactSchema.safeParse(payload);
    if (!validation.success) {
      const message = validation.error.errors[0]?.message || "Please check your form and try again.";
      showAlert(message, "error");
      return;
    }

    try {
      const result = await submitContact(validation.data).unwrap();

      showAlert(result.message || "Message sent. We'll get back to you shortly.", "success");
      form.reset();
    } catch (err) {
      const error = err as ApiError;
      showAlert(
        error.data?.error || error.data?.message || "Failed to send message. Please try again.",
        "error",
      );
    }
  };

  return (
    <section id="contact" className="border-b border-border py-12">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal>
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              Contact
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Have Questions?</h2>
            <p className="mt-4 text-muted-foreground">
              Need help, feedback, or collaboration? Reach out to us.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_3fr_1fr]">
          <div className="flex flex-col items-center justify-center"></div>
          <Reveal>
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="name" name="name" label="Name" required />
                <Field id="email" name="email" type="email" label="Email" required />
              </div>
              <div className="mt-4">
                <Field id="subject" name="subject" label="Subject" required />
              </div>
              <div className="mt-4 grid gap-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="message" rows={5} required />
              </div>
              <Button type="submit" className="mt-6 h-11 w-full sm:w-auto" disabled={isLoading}>
                {isLoading ? "Sending…" : "Send Message"}
              </Button>
            </form>
          </Reveal>
          {/* <Reveal delay={100}>
            <div className="grid gap-3">
              {INFO.map((i) => (
                <div
                  key={i.title}
                  className="card-hover flex items-start gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] text-brand">
                    <i.icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{i.title}</div>
                    <div className="truncate text-sm text-muted-foreground">{i.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal> */}
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  required,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} required={required} />
    </div>
  );
}
