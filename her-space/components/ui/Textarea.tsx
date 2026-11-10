import { forwardRef, type TextareaHTMLAttributes } from "react";

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({
  className = "",
  ...props
}, ref) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-3 text-deep-plum placeholder:text-[#6B6478] focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8] ${className}`}
      {...props}
    />
  );
});

export default Textarea;