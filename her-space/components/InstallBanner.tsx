"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "her-space-install-dismissed";

export default function InstallBanner() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setVisible(false);
      return;
    }

    try {
      const dismissedValue = window.localStorage.getItem(DISMISS_KEY);
      if (dismissedValue === "1") {
        setDismissed(true);
        setVisible(false);
        return;
      }
    } catch {
      // Ignore localStorage access errors.
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
    const isIOS = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
    const isStandalone = iosNavigator.standalone === true;

    if (isIOS && !isStandalone) {
      setVisible(true);
      return;
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  if (dismissed || !visible) return null;

  const iosNavigator = typeof window !== "undefined" ? (window.navigator as Navigator & { standalone?: boolean }) : null;
  const isIOS = typeof window !== "undefined" && /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
  const isStandalone = !!iosNavigator && iosNavigator.standalone === true;

  if (isIOS && !isStandalone) {
    return (
      <Card className="mx-auto mt-4 w-full max-w-2xl border border-white/80 bg-white/70 text-left shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-deep-plum">{t("install.title")}</h3>
            <p className="text-sm text-gray-700">{t("install.body")}</p>
            <p className="text-sm text-gray-700">{t("install.iosHint")}</p>
          </div>
          <Button
            variant="ghost"
            type="button"
            className="shrink-0"
            onClick={() => {
              try {
                window.localStorage.setItem(DISMISS_KEY, "1");
              } catch {
                // Ignore storage issues.
              }
              setDismissed(true);
              setVisible(false);
            }}
          >
            {t("install.dismiss")}
          </Button>
        </div>
      </Card>
    );
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  return (
    <Card className="mx-auto mt-4 w-full max-w-2xl border border-white/80 bg-white/70 text-left shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-deep-plum">{t("install.title")}</h3>
          <p className="text-sm text-gray-700">{t("install.body")}</p>
        </div>
        <Button
          variant="ghost"
          type="button"
          className="shrink-0"
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Ignore storage issues.
            }
            setDismissed(true);
            setVisible(false);
          }}
        >
          {t("install.dismiss")}
        </Button>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={() => void handleInstall()}>
          {t("install.button")}
        </Button>
      </div>
    </Card>
  );
}
