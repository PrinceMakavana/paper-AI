import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { fetchPublicProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Projects — paperAI",
  description:
    "Browse paperAI digital projects and study kits. Transparent pricing with secure Razorpay checkout.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Projects — paperAI",
    description: "Browse digital projects and study kits from paperAI.",
  },
};

export const dynamic = "force-dynamic";

function CatalogFrame({
  count,
  children,
}: {
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <header className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 hero-bg" />
          <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-5 pb-12 pt-28 sm:flex-row sm:items-end sm:justify-between sm:pb-14 sm:pt-32">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Catalog
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Projects
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Digital study kits and tools you can purchase securely.
              </p>
            </div>
            {typeof count === "number" ? (
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {count} {count === 1 ? "project" : "projects"}
              </p>
            ) : null}
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default async function ProjectsPage() {
  const result = await fetchPublicProjects({ cache: "no-store" });
  const projects = result.status === "ok" ? result.projects : [];
  const errorMessage = result.status === "error" ? result.message : undefined;

  if (errorMessage) {
    return (
      <CatalogFrame>
        <div className="max-w-lg rounded-lg border border-border bg-card px-6 py-8">
          <h2 className="text-base font-medium tracking-tight text-foreground">
            Projects are unavailable
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{errorMessage}</p>
        </div>
      </CatalogFrame>
    );
  }

  if (projects.length === 0) {
    return (
      <CatalogFrame count={0}>
        <div className="max-w-lg rounded-lg border border-border bg-card px-6 py-8">
          <h2 className="text-base font-medium tracking-tight text-foreground">No projects yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Projects will appear here once they are published in the catalog.
          </p>
        </div>
      </CatalogFrame>
    );
  }

  return (
    <CatalogFrame count={projects.length}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </CatalogFrame>
  );
}
