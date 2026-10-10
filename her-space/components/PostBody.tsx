"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import UserText from "@/components/UserText";

export default function PostBody({ body, href, onNavigate }: { body: string; href: string; onNavigate?: () => void }) {
  const { t } = useLanguage();
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;

    const updateTruncation = () => {
      setIsTruncated(element.scrollHeight > element.clientHeight + 1);
    };

    updateTruncation();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateTruncation);
    observer.observe(element);
    return () => observer.disconnect();
  }, [body]);

  return (
    <div className="space-y-1">
      <UserText ref={bodyRef} text={body} className="line-clamp-4 text-gray-800" />
      {isTruncated && (
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-deep-plum underline underline-offset-4" href={href} onClick={onNavigate}>
          {t("common.readMore")}
        </Link>
      )}
    </div>
  );
}