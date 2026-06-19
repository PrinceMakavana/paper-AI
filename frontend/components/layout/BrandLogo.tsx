import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "full" | "icon";

const LOGO_SRC = {
  full: {
    light: "/paper_ai_with_name.png",
    dark: "/paper_ai_with_name_dark_mode.png",
  },
  icon: {
    light: "/paper_ai_logo.png",
    dark: "/paper_ai_logo_dark_mode.png",
  },
} as const;

export function BrandLogo({
  variant = "full",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const isFull = variant === "full";
  const { light, dark } = LOGO_SRC[variant];
  const imageClass = cn("w-auto object-contain", isFull ? "h-9" : "h-9 w-9");

  return (
    <Link href="/" className={cn("inline-flex shrink-0", className)} aria-label="paperAI home">
      <Image
        src={light}
        alt="paperAI"
        width={isFull ? 140 : 36}
        height={36}
        priority={isFull}
        className={cn(imageClass, "dark:hidden")}
      />
      <Image
        src={dark}
        alt="paperAI"
        width={isFull ? 140 : 36}
        height={36}
        priority={isFull}
        className={cn(imageClass, "hidden dark:block")}
      />
    </Link>
  );
}
