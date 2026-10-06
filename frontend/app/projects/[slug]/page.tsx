import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ProjectCheckoutPanel } from "@/components/projects/ProjectCheckoutPanel";
import { ProjectGallery } from "@/components/projects/ProjectGallery";
import { Button } from "@/components/ui/button";
import {
  discountPercent,
  formatInr,
  getProjectBySlug,
} from "@/lib/projects";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProjectBySlug(slug);
  const project = result.status === "ok" ? result.project : null;

  if (!project) {
    return {
      title: "Project not found — paperAI",
      robots: { index: false },
    };
  }

  const description = project.description.slice(0, 160);

  return {
    title: `${project.title} — paperAI`,
    description,
    alternates: {
      canonical: `/projects/${project.slug}`,
    },
    openGraph: {
      title: project.title,
      description,
      images: project.images[0] ? [{ url: project.images[0] }] : undefined,
    },
  };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getProjectBySlug(slug);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 pb-20 pt-28">
          <h1 className="text-3xl font-bold tracking-tight">Project unavailable</h1>
          <p className="mt-4 text-muted-foreground">{result.message}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const project = result.project;

  const discount = discountPercent(project.originalPrice, project.currentPrice);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-28">
        <div className="mb-6">
          <Button asChild variant="ghost" className="-ml-3 text-muted-foreground">
            <Link href="/projects">← All career kits</Link>
          </Button>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <ProjectGallery title={project.title} images={project.images} />

          <div className="space-y-6">
            <div>
              <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                {project.title}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-semibold tracking-tight">
                {formatInr(project.currentPrice)}
              </span>
              {project.originalPrice > project.currentPrice ? (
                <span className="text-lg text-muted-foreground line-through">
                  {formatInr(project.originalPrice)}
                </span>
              ) : null}
              {discount > 0 ? (
                <span className="rounded-md bg-[color-mix(in_oklab,var(--brand)_18%,transparent)] px-2.5 py-1 text-sm font-semibold text-brand">
                  {discount}% off
                </span>
              ) : null}
            </div>

            <ProjectCheckoutPanel
              slug={project.slug}
              title={project.title}
              currentPrice={project.currentPrice}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
