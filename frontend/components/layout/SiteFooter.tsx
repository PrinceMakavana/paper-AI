import Link from "next/link";
import { Github, Linkedin, Twitter } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";

const COLS = [
  {
    title: "Quick Links",
    links: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms & Conditions" },
    ],
  },
  {
    title: "Features",
    links: [
      { href: "/paper-solution", label: "Paper Solutions" },
      { href: "/projects", label: "Career Kits" },
      { href: "/subjects", label: "Subject Materials" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/contribute", label: "Contribute" },
      { href: "/disclaimer", label: "Disclaimer" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-5 py-14 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <BrandLogo variant="full" />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            AI-powered paper solution and document assistant platform built for GTU students.
          </p>
          <div className="mt-5 flex items-center gap-2">
            {[Linkedin, Github, Twitter].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="Social link"
                className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-brand hover:text-foreground"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-semibold">{c.title}</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} paperAI. All rights reserved.</p>
          <p>Made for GTU students.</p>
        </div>
      </div>
    </footer>
  );
}
