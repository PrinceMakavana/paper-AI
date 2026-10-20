import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-lg flex-col items-center px-5 pb-24 pt-36 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Project not found</h1>
        <p className="mt-4 text-muted-foreground">
          That project slug does not exist or is no longer available. Check the link
          or browse the full catalog.
        </p>
        {/* <Button asChild className="mt-8">
          <Link href="/projects">Browse career kits</Link>
        </Button> */}
      </main>
      <SiteFooter />
    </div>
  );
}
