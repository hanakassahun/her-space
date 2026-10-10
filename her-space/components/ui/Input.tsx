import type { InputHTMLAttributes } from "react";

export default function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-2.5 text-deep-plum placeholder:text-[#6B6478] focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8] ${className}`}
      {...props}
    />
  );
}