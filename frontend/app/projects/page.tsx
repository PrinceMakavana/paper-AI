import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  discountPercent,
  formatInr,
  getAllProjects,
} from "@/lib/projects";

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

export default function ProjectsPage() {
  const projects = getAllProjects();

  return (
    <PageShell
      eyebrow="Shop"
      title="Projects"
      description="Digital study kits and tools you can purchase securely. Add another item to the catalog JSON and it appears here automatically."
    >
      {projects.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-foreground">No projects yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Projects will appear here once they are added to the catalog.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {projects.map((project) => {
            const discount = discountPercent(project.originalPrice, project.currentPrice);
            const image = project.images[0];

            return (
              <article
                key={project.slug}
                className="card-hover flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]"
              >
                <div className="relative aspect-[16/10] bg-muted">
                  {image ? (
                    <Image
                      src={image}
                      alt={project.title}
                      fill
                      unoptimized={image.endsWith(".svg")}
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  ) : null}
                  {discount > 0 ? (
                    <span className="absolute left-3 top-3 rounded-md bg-brand px-2 py-1 text-xs font-semibold text-brand-foreground">
                      {discount}% off
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {project.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-xl font-semibold text-foreground">
                      {formatInr(project.currentPrice)}
                    </span>
                    {project.originalPrice > project.currentPrice ? (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatInr(project.originalPrice)}
                      </span>
                    ) : null}
                  </div>
                  <Button asChild className="mt-5 w-full">
                    <Link href={`/projects/${project.slug}`}>View Project</Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
