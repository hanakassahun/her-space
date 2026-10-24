"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f9f7fb] text-deep-plum">
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
          <Card className="w-full max-w-xl space-y-6 border border-white/60 bg-white/75 text-center shadow-[0_20px_60px_rgba(84,54,110,0.12)] backdrop-blur-md">
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-deep-plum">Something went wrong on our side</h1>
              <p className="text-sm leading-6 text-gray-700">It isn&apos;t you. Please try again in a moment.</p>
              <h2 className="pt-2 text-xl font-semibold text-deep-plum">በእኛ በኩል የሆነ ችግር ተፈጥሯል</h2>
              <p className="text-sm leading-6 text-gray-700">ያንቺ ጥፋት አይደለም። እባክሽ ትንሽ ቆይተሽ እንደገና ሞክሪ።</p>
            </div>

            <Button onClick={() => reset()}>Try again</Button>
          </Card>
        </div>
      </body>
    </html>
  );
}
