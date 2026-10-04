import type { InputHTMLAttributes } from "react";

export default function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-deep-plum placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-soft-lilac ${className}`}
      {...props}
    />
  );
}