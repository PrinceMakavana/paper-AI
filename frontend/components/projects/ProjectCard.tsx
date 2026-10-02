import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { discountPercent, formatInr, type Project } from "@/lib/projects";

export function ProjectCard({ project }: { project: Project }) {
  const discount = discountPercent(project.originalPrice, project.currentPrice);
  const image = project.images[0];
  const onSale = project.originalPrice > project.currentPrice;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex h-full flex-col rounded-lg border border-border bg-card outline-none transition-colors duration-200 hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="p-2.5 pb-0">
        <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-muted ring-1 ring-border">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              unoptimized={image.startsWith("http") || image.endsWith(".svg")}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
        <h2 className="line-clamp-2 text-[15px] font-medium leading-snug tracking-tight text-foreground">
          {project.title}
        </h2>
        {project.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {project.description}
          </p>
        ) : null}
        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3.5">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="text-sm font-medium tabular-nums text-foreground">
                {formatInr(project.currentPrice)}
              </span>
              {onSale ? (
                <span className="text-xs tabular-nums text-muted-foreground line-through">
                  {formatInr(project.originalPrice)}
                </span>
              ) : null}
              {discount > 0 ? (
                <span className="shrink-0 text-xs text-muted-foreground">{discount}% off</span>
              ) : null}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 group-hover:text-foreground">
              View
              <ArrowRight
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
