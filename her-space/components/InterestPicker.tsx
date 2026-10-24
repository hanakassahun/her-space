"use client";

import Button from "@/components/ui/Button";
import { INTEREST_TOPICS } from "@/lib/interests";

type InterestPickerProps = {
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
};

export default function InterestPicker({ selected, onChange, disabled = false }: InterestPickerProps) {
  function toggle(topic: string) {
    if (selected.includes(topic)) {
      onChange(selected.filter((item) => item !== topic));
    } else if (selected.length < 6) {
      onChange([...selected, topic]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {INTEREST_TOPICS.map((topic) => {
        const active = selected.includes(topic);
        const label = topic === "pcos" ? "PCOS" : topic;
        return (
          <Button
            key={topic}
            variant={active ? "primary" : "secondary"}
            className="min-h-11 max-w-full whitespace-normal break-words px-3 text-center leading-snug"
            type="button"
            aria-pressed={active}
            disabled={disabled || (!active && selected.length >= 6)}
            onClick={() => toggle(topic)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
