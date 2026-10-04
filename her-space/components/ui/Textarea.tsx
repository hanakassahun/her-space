import type { TextareaHTMLAttributes } from "react";

export default function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-deep-plum placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-soft-lilac ${className}`}
      {...props}
    />
  );
}