import type { Metadata } from "next";
import { PageShell, Prose } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Terms & Conditions — paperAI",
  description:
    "Terms of use for paperAI including acceptable use, intellectual property, and account policies.",
  openGraph: {
    title: "paperAI Terms & Conditions",
    description: "Read the terms before using paperAI.",
  },
};

export default function TermsPage() {
  return (
    <PageShell eyebrow="Legal" title="Terms & Conditions">
      <Prose>
        <h2>User responsibilities</h2>
        <p>
          You are responsible for maintaining the security of your account and for any activity that
          occurs under it.
        </p>
        <h2>Acceptable use</h2>
        <p>
          You agree not to use paperAI for unlawful, fraudulent, or abusive activity, including
          academic dishonesty in violation of your institution&apos;s policies.
        </p>
        <h2>Intellectual property</h2>
        <p>
          The paperAI platform, branding, and software are owned by paperAI. You retain ownership of
          content you upload.
        </p>
        <h2>Account usage</h2>
        <p>
          Accounts are personal. Sharing credentials or attempting unauthorized access is
          prohibited.
        </p>
        <h2>Service limitations</h2>
        <p>
          paperAI is provided &quot;as is&quot; without warranties of any kind. We may modify or
          discontinue features at any time.
        </p>
        <h2>Content ownership</h2>
        <p>
          You own the documents you upload. By using the service you grant paperAI the limited right
          to process them to deliver the features you request.
        </p>
        <h2>Termination</h2>
        <p>We may suspend or terminate accounts that violate these terms or the law.</p>
      </Prose>
    </PageShell>
  );
}
