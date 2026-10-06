import type { TranslationKey } from "@/lib/i18n/en";

export type NavIconKey =
  | "home"
  | "feed"
  | "explore"
  | "write"
  | "journal"
  | "learn"
  | "library"
  | "resources"
  | "profile"
  | "admin"
  | "settings"
  | "rules"
  | "more";

export type NavKey =
  | "home"
  | "feed"
  | "explore"
  | "write"
  | "journal"
  | "learn"
  | "library"
  | "resources"
  | "profile"
  | "admin"
  | "settings"
  | "rules";

export type NavItem = {
  label: TranslationKey;
  href: string;
  icon: NavIconKey;
  adminOnly?: boolean;
};

export const navConfig: Record<NavKey, NavItem> = {
  home: { label: "nav.home", href: "/", icon: "home" },
  feed: { label: "nav.feed", href: "/feed", icon: "feed" },
  explore: { label: "nav.explore", href: "/explore", icon: "explore" },
  write: { label: "nav.write", href: "/new", icon: "write" },
  journal: { label: "nav.journal", href: "/journal", icon: "journal" },
  learn: { label: "nav.learn", href: "/learn", icon: "learn" },
  library: { label: "nav.library", href: "/library", icon: "library" },
  resources: { label: "nav.resources", href: "/resources", icon: "resources" },
  profile: { label: "nav.profile", href: "/u/{userId}", icon: "profile" },
  admin: { label: "nav.admin", href: "/admin", icon: "admin", adminOnly: true },
  settings: { label: "nav.settings", href: "/settings", icon: "settings" },
  rules: { label: "nav.rules", href: "/rules", icon: "rules" },
};

export const desktopNavOrder: NavKey[] = [
  "home",
  "feed",
  "explore",
  "write",
  "journal",
  "learn",
  "library",
  "resources",
  "rules",
  "settings",
  "profile",
  "admin",
];

export const desktopPrimaryNavOrder: NavKey[] = [
  "home",
  "feed",
  "explore",
  "learn",
  "journal",
  "library",
  "resources",
];

export const desktopAccountNavOrder: NavKey[] = ["profile", "rules", "settings", "admin"];

export const mobileNavOrder: NavKey[] = ["home", "explore", "write", "journal"];
export const moreNavOrder: NavKey[] = ["feed", "learn", "library", "resources", "rules", "settings", "profile", "admin"];

export function resolveNavHref(key: NavKey, userId: string) {
  return navConfig[key].href.replace("{userId}", userId);
}

export function isNavItemActive(key: NavKey, pathname: string) {
  if (key === "home") return pathname === "/";
  if (key === "feed") return pathname === "/feed" || pathname.startsWith("/post/");
  if (key === "profile") return pathname.startsWith("/u/");
  return pathname === navConfig[key].href || pathname.startsWith(`${navConfig[key].href}/`);
}

export function isTopLevelPath(pathname: string) {
  return pathname === "/u/" || pathname.startsWith("/u/") ||
    desktopNavOrder.some((key) => {
      const href = navConfig[key].href;
      return !href.includes("{") && pathname === href;
    });
}