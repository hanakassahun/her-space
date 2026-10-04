"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NavItem = {
  label: string;
  href: string;
  icon: "home" | "explore" | "write" | "library" | "profile";
};

const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Explore", href: "/explore", icon: "explore" },
  { label: "Write", href: "/new", icon: "write" },
  { label: "Library", href: "/library", icon: "library" },
];

function NavIcon({ icon }: { icon: NavItem["icon"] }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    className: "h-5 w-5",
  };

  if (icon === "home") {
    return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z" /></svg>;
  }
  if (icon === "explore") {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m15.8 8.2-2.4 5.2-5.2 2.4 2.4-5.2z" /></svg>;
  }
  if (icon === "write") {
    return <svg {...common}><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20l-5 1 1-5z" /></svg>;
  }
  if (icon === "library") {
    return <svg {...common}><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22z" /><path d="M5 4.5v17M9 6h7M9 10h7" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

export default function BottomNav() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const excludedRoute = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (!userId || excludedRoute) return null;

  const items: NavItem[] = [
    ...navItems,
    { label: "Profile", href: `/u/${userId}`, icon: "profile" },
  ];

  return (
    <nav
      className="glass fixed inset-x-3 bottom-0 z-50 rounded-b-none px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:hidden"
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around gap-1">
        {items.map(({ label, href, icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li className="min-w-0 flex-1" key={label}>
              <Link
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-medium ${
                  active ? "text-deep-plum" : "text-gray-600"
                }`}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                <NavIcon icon={icon} />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}