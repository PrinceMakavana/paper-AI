import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type ExternalLinkAnchorProps = Omit<ComponentProps<"a">, "target" | "rel"> & {
  iconClassName?: string;
};

export function ExternalLinkAnchor({
  href,
  children,
  className,
  iconClassName,
  ...props
}: ExternalLinkAnchorProps) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 align-baseline underline underline-offset-2 opacity-85 hover:opacity-100",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <ExternalLink className={cn("inline size-3 shrink-0 opacity-70", iconClassName)} aria-hidden />
    </a>
  );
}
