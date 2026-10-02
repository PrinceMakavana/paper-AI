import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <header className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 hero-bg" />
          <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-28 sm:pb-14 sm:pt-32">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-12 w-48 animate-pulse rounded-md bg-muted" />
            <div className="mt-4 h-5 w-full max-w-md animate-pulse rounded bg-muted" />
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="p-2.5 pb-0">
                  <div className="aspect-[16/9] animate-pulse rounded-md bg-muted" />
                </div>
                <div className="space-y-3 px-4 pb-4 pt-4">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                  <div className="mt-5 border-t border-border pt-3.5">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
