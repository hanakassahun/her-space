import type { HTMLAttributes } from "react";

type BadgeVariant = "rose" | "lilac" | "sky" | "mint";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  rose: "bg-blush-rose/70 text-deep-plum",
  lilac: "bg-soft-lilac text-deep-plum",
  sky: "bg-periwinkle/60 text-deep-plum",
  mint: "bg-aurora-cyan/60 text-deep-plum",
};

export default function Badge({
  variant = "lilac",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}