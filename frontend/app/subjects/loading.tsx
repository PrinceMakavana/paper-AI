import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function SubjectsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-16 pt-24 sm:px-6">
        <header className="max-w-3xl">
          <div className="h-3 w-28 rounded-full bg-muted" />
          <div className="mt-4 h-10 w-72 max-w-full rounded-lg bg-muted" />
          <div className="mt-4 h-5 w-full max-w-2xl rounded bg-muted" />
          <div className="mt-2 h-5 w-2/3 rounded bg-muted" />
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="h-8 w-24 rounded bg-muted" />
              <div className="mt-4 h-4 w-full rounded bg-muted" />
              <div className="mt-2 h-4 w-2/3 rounded bg-muted" />
              <div className="mt-5 flex gap-2">
                <div className="h-7 w-16 rounded-full bg-muted" />
                <div className="h-7 w-20 rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
