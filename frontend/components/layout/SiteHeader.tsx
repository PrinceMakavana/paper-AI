"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { useAuth } from "@/components/context/auth/auth-context";
import { ROUTES, signupHref, startChatHref } from "@/lib/landing-links";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", exact: true },
  { href: "/about", label: "About", exact: false },
  { href: "/contribute", label: "Contribute", exact: false },
  { href: "/contact", label: "Contact", exact: false },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { isUserLoggedIn } = useAuth();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-5">
        <BrandLogo variant="full" className="hidden sm:inline-flex" />
        <BrandLogo variant="icon" className="sm:hidden" />

        <nav className="hidden items-center justify-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(n.href, n.exact) && "bg-muted text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/#features">Features</Link>
          </Button>
          {!isUserLoggedIn && (
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href={ROUTES.login}>Login</Link>
            </Button>
          )}
          <Button asChild className="hidden sm:inline-flex">
            <Link href={isUserLoggedIn ? startChatHref(isUserLoggedIn) : signupHref(isUserLoggedIn)}>
              {isUserLoggedIn ? "Open Chat" : "Start Free"}
            </Link>
          </Button>
          <button
            type="button"
            aria-label="Toggle menu"
            className="grid size-9 place-items-center rounded-md border border-border md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-5 py-3">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive(n.href, n.exact) && "bg-muted text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
            <Link
              href="/#features"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Features
            </Link>
            {!isUserLoggedIn && (
              <Link
                href={ROUTES.login}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Login
              </Link>
            )}
            <Link
              href={isUserLoggedIn ? startChatHref(isUserLoggedIn) : signupHref(isUserLoggedIn)}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {isUserLoggedIn ? "Open Chat" : "Start Free"}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
