export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 pb-16 pt-36">
        <div className="mx-auto h-8 w-40 animate-pulse rounded-full bg-muted" />
        <div className="mx-auto mt-6 h-12 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="mx-auto mt-4 h-5 w-full max-w-xl animate-pulse rounded bg-muted" />
        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="aspect-[16/10] animate-pulse bg-muted" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
