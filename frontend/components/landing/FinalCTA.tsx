"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/layout/Reveal";
import { useAuth } from "@/components/context/auth/auth-context";
import { ROUTES, signupHref, startChatHref } from "@/lib/landing-links";

export function FinalCTA() {
  const { isUserLoggedIn } = useAuth();

  return (
    <section
      id="cta"
      className="border-b border-border bg-primary py-24 text-primary-foreground"
    >
      <div className="mx-auto max-w-4xl px-5 text-center">
        <Reveal>
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Ready to Solve GTU Papers Smarter?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-primary-foreground/70 sm:text-lg">
            Join students using AI to generate solutions, understand concepts,
            and prepare confidently for exams.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {!isUserLoggedIn ? (
              <Button
                size="lg"
                variant="secondary"
                className="h-11 px-6"
                asChild
              >
                <Link href={signupHref(isUserLoggedIn)}>
                  Start Free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="h-11 border-primary-foreground/30 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:border-primary-foreground/30 dark:text-primary-foreground dark:hover:bg-primary-foreground/10 dark:hover:text-primary-foreground"
                asChild
              >
                <Link href={startChatHref(isUserLoggedIn)}>Open Chat</Link>
              </Button>
            )}
            {/* <Button
              size="lg"
              variant="outline"
              className="h-11 border-primary-foreground/30 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:border-primary-foreground/30 dark:text-primary-foreground dark:hover:bg-primary-foreground/10 dark:hover:text-primary-foreground"
              asChild
            >
              <Link href={ROUTES.projects}>Career Kits</Link>
            </Button> */}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
