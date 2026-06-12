import type { Metadata } from "next";
import { PageShell, Prose } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — paperAI",
  description: "How paperAI collects, processes, and protects your data.",
  openGraph: {
    title: "paperAI Privacy Policy",
    description: "Data collection, processing, and your rights.",
  },
};

export default function PrivacyPage() {
  return (
    <PageShell eyebrow="Legal" title="Privacy Policy">
      <Prose>
        <h2>Data collection</h2>
        <p>
          We collect account information, the documents you upload, and usage data needed to deliver
          and improve the service.
        </p>
        <h2>Authentication information</h2>
        <p>
          We store the minimum identifiers required to sign you in and link your workspace to your
          account.
        </p>
        <h2>Document processing</h2>
        <p>
          Uploaded documents are processed to generate summaries, answers, and search indexes. Where
          supported, you can use local Ollama models to keep processing on your machine.
        </p>
        <h2>Security measures</h2>
        <p>Data is encrypted in transit. Access to stored documents is scoped to your account.</p>
        <h2>User rights</h2>
        <p>You can request export or deletion of your account data at any time.</p>
        <h2>Data retention</h2>
        <p>
          Documents and workspaces are retained while your account is active. Deleting them removes
          them from active storage within a short window.
        </p>
      </Prose>
    </PageShell>
  );
}
