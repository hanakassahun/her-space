"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/components/LanguageProvider";
import Button from "@/components/ui/Button";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export default function SeriesFollowButton({ rootId, authorId }: { rootId: string; authorId: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [following, setFollowing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user || user.id === authorId) return;
    let active = true;
    void supabase.from("series_follows").select("root_post_id")
      .eq("user_id", user.id)
      .eq("root_post_id", rootId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(friendlyError(error, t));
        else setFollowing(Boolean(data));
      });
    return () => { active = false; };
  }, [authorId, rootId, t, user]);

  async function toggle() {
    if (!user || saving) return;
    setSaving(true);
    setMessage("");
    const previous = following;
    setFollowing(!previous);
    const result = previous
      ? await supabase.from("series_follows").delete().eq("root_post_id", rootId)
      : await supabase.from("series_follows").insert({ root_post_id: rootId });
    if (result.error) {
      setFollowing(previous);
      setMessage(friendlyError(result.error, t));
    }
    setSaving(false);
  }

  if (!user || user.id === authorId) return null;
  return <div className="space-y-1">
    <Button variant={following ? "secondary" : "primary"} type="button" disabled={saving} onClick={() => void toggle()}>{following ? t("series.following") : t("series.follow")}</Button>
    {message && <p className="break-words text-xs text-red-700" role="alert">{message}</p>}
  </div>;
}
