import type { Metadata } from "next";
import { PageShell, Prose } from "@/components/layout/PageShell";

export const metadata: Metadata = {
  title: "Disclaimer — paperAI",
  description:
    "Important information about paperAI's educational purpose and AI-generated content.",
  alternates: {
    canonical: "/disclaimer",
  },
  openGraph: {
    title: "paperAI Disclaimer",
    description: "Educational use, accuracy notes, and GTU affiliation disclaimer.",
  },
};

export default function DisclaimerPage() {
  return (
    <PageShell eyebrow="Legal" title="Disclaimer">
      <Prose>
        <h2>Educational purpose only</h2>
        <p>
          paperAI is intended strictly for educational and study purposes. Content generated should
          be used as a learning aid, not as a substitute for official course material.
        </p>
        <h2>AI-generated answers may contain mistakes</h2>
        <p>
          AI models can produce inaccurate or incomplete information. Always cross-check important
          answers against trusted sources.
        </p>
        <h2>Verify important information</h2>
        <p>
          Before relying on a generated solution for an exam or submission, verify it against
          textbooks, faculty notes, or official references.
        </p>
        <h2>Not affiliated with GTU</h2>
        <p>
          paperAI is an independent platform and is not affiliated with, endorsed by, or sponsored
          by Gujarat Technological University (GTU).
        </p>
        <h2>No guarantee of examination results</h2>
        <p>
          Use of paperAI does not guarantee any examination outcome, grade, or academic result.
        </p>
      </Prose>
    </PageShell>
  );
}
