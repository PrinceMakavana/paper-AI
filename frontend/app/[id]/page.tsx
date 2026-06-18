import { permanentRedirect } from "next/navigation";

type LegacySubjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacySubjectPage({ params }: LegacySubjectPageProps) {
  const { id } = await params;
  permanentRedirect(`/subjects/${encodeURIComponent(id)}`);
}
