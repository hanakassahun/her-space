"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/components/LanguageProvider";

type BlockState = "mute" | "block" | null;

type Props = {
  memberId: string;
  onChanged?: (state: BlockState) => void;
};

export default function MemberActionsMenu({ memberId, onChanged }: Props) {
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [blockState, setBlockState] = useState<BlockState>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [confirming, setConfirming] = useState<"mute" | "block" | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [showReportHint, setShowReportHint] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirming(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (userId === undefined || userId === null || userId === memberId) return null;

  async function openMenu() {
    setOpen(true);
    setResultMsg("");
    setShowReportHint(false);
    setConfirming(null);
    if (loadingState) return;
    setLoadingState(true);
    const { data } = await supabase
      .from("user_blocks")
      .select("kind")
      .eq("blocked_id", memberId)
      .maybeSingle();
    setBlockState((data?.kind as BlockState) ?? null);
    setLoadingState(false);
  }

  async function applyAction(kind: "mute" | "block") {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("user_blocks")
      .upsert({ blocked_id: memberId, kind }, { onConflict: "blocker_id,blocked_id" });
    if (error) {
      setResultMsg(friendlyError(error, t));
    } else {
      setBlockState(kind);
      setResultMsg(t(kind === "mute" ? "safety.mutedDone" : "safety.blockedDone"));
      setShowReportHint(true);
      setConfirming(null);
      onChanged?.(kind);
    }
    setBusy(false);
  }

  async function removeAction() {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocked_id", memberId);
    if (error) {
      setResultMsg(friendlyError(error, t));
    } else {
      setBlockState(null);
      setResultMsg(t("safety.restored"));
      setShowReportHint(false);
      onChanged?.(null);
    }
    setBusy(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label={t("safety.menu")}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition hover:bg-soft-lilac/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
        onClick={() => (open ? setOpen(false) : void openMenu())}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 min-w-[200px] rounded-2xl border border-[#CDBDEB] bg-white shadow-lg"
        >
          {confirming ? (
            <div className="space-y-3 p-4">
              <p className="text-sm text-gray-700">
                {t(confirming === "mute" ? "safety.muteInfo" : "safety.blockInfo")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1 text-sm"
                  disabled={busy}
                  onClick={() => void applyAction(confirming)}
                >
                  {t(confirming === "mute" ? "safety.confirmMute" : "safety.confirmBlock")}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  className="text-sm"
                  onClick={() => setConfirming(null)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
              {resultMsg && (
                <p className="text-sm text-red-700" role="alert"><FriendlyErrorMessage message={resultMsg} /></p>
              )}
            </div>
          ) : (
            <div className="py-2">
              {resultMsg ? (
                <div className="space-y-2 px-4 py-3">
                  <p className="text-sm text-gray-800"><FriendlyErrorMessage message={resultMsg} /></p>
                  {showReportHint && (
                    <p className="text-xs text-gray-600">{t("safety.reportHint")}</p>
                  )}
                  <Button
                    variant="ghost"
                    type="button"
                    className="mt-1 text-sm"
                    onClick={() => setOpen(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : loadingState ? (
                <p className="px-4 py-3 text-sm text-gray-500">{t("common.loading")}</p>
              ) : (
                <>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={busy}
                    className="flex min-h-[44px] w-full items-center px-4 py-3 text-left text-sm text-deep-plum hover:bg-soft-lilac/20 disabled:opacity-50"
                    onClick={() => {
                      if (blockState === "mute" || blockState === "block") {
                        void removeAction();
                      } else {
                        setConfirming("mute");
                      }
                    }}
                  >
                    {blockState === "mute" || blockState === "block"
                      ? t("safety.unmute")
                      : t("safety.mute")}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    disabled={busy}
                    className="flex min-h-[44px] w-full items-center px-4 py-3 text-left text-sm text-deep-plum hover:bg-soft-lilac/20 disabled:opacity-50"
                    onClick={() => {
                      if (blockState === "block") {
                        void removeAction();
                      } else {
                        setConfirming("block");
                      }
                    }}
                  >
                    {blockState === "block" ? t("safety.unblock") : t("safety.block")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
