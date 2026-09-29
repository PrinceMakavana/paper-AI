"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ProjectGalleryProps = {
  title: string;
  images: string[];
};

export function ProjectGallery({ title, images }: ProjectGalleryProps) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  if (!current) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        No image available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-muted">
        <Image
          src={current}
          alt={`${title} — image ${active + 1}`}
          fill
          unoptimized={current.endsWith(".svg")}
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 55vw"
          priority
        />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-md border",
                index === active ? "border-brand ring-2 ring-brand/40" : "border-border",
              )}
              aria-label={`Show image ${index + 1}`}
            >
              <Image
                src={src}
                alt=""
                fill
                unoptimized={src.endsWith(".svg")}
                className="object-cover"
                sizes="96px"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
