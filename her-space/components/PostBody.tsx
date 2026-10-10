"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

export default function PostBody({ body, href }: { body: string; href: string }) {
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
      <p ref={bodyRef} className="line-clamp-4 break-words whitespace-pre-wrap text-gray-800">
        {body}
      </p>
      {isTruncated && (
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-deep-plum underline underline-offset-4" href={href}>
          {t("common.readMore")}
        </Link>
      )}
    </div>
  );
}