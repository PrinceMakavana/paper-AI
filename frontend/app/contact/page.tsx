import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { ContactSection } from "@/components/landing/ContactSection";

export const metadata: Metadata = {
  title: "Contact paperAI — Support, Feedback, Partnerships",
  description: "Get in touch with the paperAI team for support, feedback, and business inquiries.",
  openGraph: {
    title: "Contact paperAI",
    description: "Support, feedback, and partnerships.",
  },
};

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="We'd love to hear from you"
      description="Support, feedback, and business inquiries — we respond within 24 hours on weekdays."
    >
      {/* <div className="mb-12 grid gap-4 sm:grid-cols-3">
        <Card icon={Mail} title="Email Support" text="support@paperai.app" />
        <Card icon={HelpCircle} title="FAQ" text="Browse common questions" href="/#faq" />
        <Card icon={Briefcase} title="Business" text="business@paperai.app" />
      </div> */}
      {/* <div className=""> */}
        <ContactSection />
      {/* </div> */}
    </PageShell>
  );
}

// function Card({
//   icon: Icon,
//   title,
//   text,
//   href,
// }: {
//   icon: React.ComponentType<{ className?: string }>;
//   title: string;
//   text: string;
//   href?: string;
// }) {
//   const body = (
//     <>
//       <div className="grid size-10 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand)_15%,transparent)] text-brand">
//         <Icon className="size-5" />
//       </div>
//       <div className="mt-4 text-sm font-semibold">{title}</div>
//       <div className="text-sm text-muted-foreground">{text}</div>
//     </>
//   );

//   return href ? (
//     <Link href={href} className="card-hover block rounded-xl border border-border bg-card p-5">
//       {body}
//     </Link>
//   ) : (
//     <div className="card-hover rounded-xl border border-border bg-card p-5">{body}</div>
//   );
// }
