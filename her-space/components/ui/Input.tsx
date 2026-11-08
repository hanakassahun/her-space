import { forwardRef, type InputHTMLAttributes } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...props },
  ref,
) {
  return (
    <input
      className={`min-h-11 w-full rounded-2xl border border-[#CDBDEB] bg-white px-4 py-2.5 text-deep-plum placeholder:text-[#6B6478] focus:border-[#8F72BE] focus:outline-none focus:ring-2 focus:ring-[#B49AD8] ${className}`}
      ref={ref}
      {...props}
    />
  );
});

export default Input;