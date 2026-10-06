import Link from "next/link";
import { ArrowRight, FileText, Layers, Rocket } from "lucide-react";
const OFFERS = [
  {
    slug: "ats-resume-templates",
    href: "/projects/ats-resume-templates",
    title: "ATS Resume Templates",
    cta: "Get Templates",
    icon: "resume",
  },
  {
    slug: "frontend-system-design",
    href: "/projects/frontend-system-design",
    title: "Frontend System Design",
    cta: "Explore System Design",
    icon: "frontend",
  },
] as const;

function OfferIcon({ icon }: { icon: (typeof OFFERS)[number]["icon"] }) {
  const Icon = icon === "resume" ? FileText : Layers;
  return <Icon className="size-4" aria-hidden />;
}

export function CareerKitsStrip() {
  return (
    <section
      aria-label="Career kits"
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[image:var(--gradient-spark)]" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0 lg:max-w-md">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand)_16%,transparent)] text-brand">
              <Rocket className="size-4" aria-hidden />
            </span>
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Preparing for placements?
            </h2>
          </div>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Get resources to improve your resume and prepare for interviews.
          </p>
          <Link
            href="/projects"
            className="group mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-background/70 px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:border-brand/40 hover:bg-[color-mix(in_oklab,var(--brand)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See all career kits
            <ArrowRight
              className="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden
            />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:w-[34rem] lg:shrink-0 lg:grid-cols-2">
          {OFFERS.map((offer) => (
            <Link
              key={offer.slug}
              href={offer.href}
              className="card-hover group flex flex-col justify-between gap-3 rounded-xl border border-border bg-background/80 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                  <OfferIcon icon={offer.icon} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-foreground">{offer.title}</p>
                </div>
              </div>
              <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors group-hover:bg-primary/90">
                {offer.cta}
                <ArrowRight
                  className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
