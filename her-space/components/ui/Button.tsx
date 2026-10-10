import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary: "border border-transparent gradient-aurora text-white shadow-glow hover:brightness-105",
  secondary: "border border-[#CDBDEB] bg-white text-deep-plum shadow-sm hover:bg-soft-lilac/20",
  ghost: "text-deep-plum hover:bg-white/50",
};

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}