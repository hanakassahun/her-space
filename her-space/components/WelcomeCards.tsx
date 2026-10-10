"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const steps = [
  { title: "welcome.step1Title", body: "welcome.step1Body" },
  { title: "welcome.step2Title", body: "welcome.step2Body" },
  { title: "welcome.step3Title", body: "welcome.step3Body" },
] as const;

export default function WelcomeCards() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem("welcomeSeen") !== "1");
    } catch {
      setVisible(false);
    }
  }, []);

  function finish() {
    try {
      window.localStorage.setItem("welcomeSeen", "1");
    } catch {
      setVisible(false);
      return;
    }
    setVisible(false);
  }

  if (!visible) return null;

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <Card className="mx-auto mt-4 w-full max-w-2xl space-y-5 text-left">
      <div className="min-w-0 space-y-2 break-words">
        <h2 className="text-xl font-semibold leading-snug text-deep-plum">
          {t("welcome.title")}
        </h2>
        <h3 className="text-base font-semibold leading-snug text-gray-900">
          {t(currentStep.title)}
        </h3>
        <p className="break-words text-sm leading-6 text-gray-700">
          {t(currentStep.body)}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {steps.map((item, index) => (
          <span
            key={item.title}
            className={`h-2 w-2 rounded-full ${index === step ? "bg-deep-plum" : "bg-deep-plum/25"}`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-gray-600 underline underline-offset-4 hover:text-deep-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-periwinkle"
          type="button"
          onClick={finish}
        >
          {t("welcome.skip")}
        </button>
        <Button type="button" onClick={isLastStep ? finish : () => setStep((current) => current + 1)}>
          {t(isLastStep ? "welcome.done" : "welcome.next")}
        </Button>
      </div>
    </Card>
  );
}