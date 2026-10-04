import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
};

export default function Card({ as = "section", className = "", ...props }: CardProps) {
  const Component = as;
  return <Component className={`glass animate-fade-up p-5 ${className}`} {...props} />;
}