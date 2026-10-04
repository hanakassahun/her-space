import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  header?: ReactNode;
  className?: string;
};

export default function PageShell({ children, header, className = "" }: PageShellProps) {
  return (
    <main className={`mx-auto w-full max-w-2xl px-4 py-6 ${className}`}>
      {header && <header className="mb-6">{header}</header>}
      {children}
    </main>
  );
}