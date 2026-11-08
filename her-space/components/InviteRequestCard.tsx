"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/errors";
import FriendlyErrorMessage from "@/components/FriendlyErrorMessage";
import { useLanguage } from "@/components/LanguageProvider";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

export default function InviteRequestCard() {
  const { t } = useLanguage();
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || sent) return;
    if (website) {
      setSent(true);
      return;
    }

    const trimmedContact = contact.trim();
    const trimmedNote = note.trim();
    if (trimmedContact.length < 3 || trimmedContact.length > 120 || trimmedNote.length > 300) {
      setMessage(friendlyError(new Error("Enter a contact between 3 and 120 characters, and a note no longer than 300 characters."), t));
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase.from("invite_requests").insert({
        contact: trimmedContact,
        note: trimmedNote || null,
      });
      if (!error || error.message.toLowerCase().includes("duplicate_request")) {
        setSent(true);
      } else {
        setMessage(friendlyError(error, t));
      }
    } catch (error) {
      setMessage(friendlyError(error, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" className="w-full max-w-lg space-y-3 text-left" aria-labelledby="invite-request-title">
      <div className="space-y-1">
        <h2 id="invite-request-title" className="break-words text-xl font-semibold text-deep-plum">{t("invite.request.title")}</h2>
        <p className="break-words text-sm leading-6 text-gray-700">{t("invite.request.body")}</p>
      </div>
      {sent ? (
        <p className="break-words text-sm font-medium text-emerald-800" role="status">{t("invite.request.thanks")}</p>
      ) : (
        <form className="space-y-3" onSubmit={(event) => void submitRequest(event)}>
          <Input
            type="text"
            autoComplete="email"
            placeholder={t("invite.request.contact")}
            aria-label={t("invite.request.contact")}
            minLength={3}
            maxLength={120}
            required
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
          <Textarea
            className="min-h-20 resize-y"
            placeholder={t("invite.request.note")}
            aria-label={t("invite.request.note")}
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <input
            className="absolute -left-[10000px] h-px w-px overflow-hidden"
            type="text"
            name="website"
            autoComplete="off"
            tabIndex={-1}
            aria-hidden="true"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          {message && <p className="break-words text-sm text-red-700" role="alert"><FriendlyErrorMessage message={message} /></p>}
          <Button type="submit" disabled={saving}>{t("invite.request.send")}</Button>
        </form>
      )}
      <p className="break-words text-xs leading-5 text-gray-600">{t("invite.request.privacy")}</p>
    </Card>
  );
}
