import type { TextareaHTMLAttributes } from "react";

export default function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-3 text-deep-plum placeholder:text-[#6B6478] focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8] ${className}`}
      {...props}
    />
  );
}