/**
 * @file TemplateEditorStyleControls.tsx
 * @description Reusable style button and style input controls with strict 44x44px minimum touch targets.
 */

import React, { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface StyleBtnProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}

export function StyleBtn({ active, onClick, children, title }: StyleBtnProps): React.JSX.Element {
  return (
    <Button
      type="button"
      title={title}
      aria-label={title}
      /*
       * `aria-pressed` is what makes these toggles perceivable to a screen reader:
       * bold / italic / underline / alignment previously communicated their state
       * only through a background colour.
       */
      aria-pressed={Boolean(active)}
      onClick={onClick}
      variant="ghost"
      className={`min-h-11 min-w-11 flex items-center justify-center p-0 rounded text-xs transition-colors border shadow-none ${
        active
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95"
          : "border-border hover:bg-muted text-foreground"
      }`}
    >
      {children}
    </Button>
  );
}

export interface StyleInputProps {
  label: string;
  value: string | number;
  onChange: (nextValue: string | number) => void;
  /** @deprecated Use `numeric` instead — `type="number"` is banned. */
  type?: string;
  /** When true, treats input as a numeric field (inputMode="numeric"). */
  numeric?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * Number/text field for the inspector.
 *
 * Edits are held as local draft text and only committed once they parse, so
 * clearing the field no longer snaps the element to a value: `Number("")` is `0`,
 * which previously meant "delete the X value" teleported the element to 0 and
 * "delete the font size" clamped it to the 6px floor. The draft is discarded on
 * blur so the field always re-syncs with the authoritative template value.
 */
export function StyleInput({
  label,
  value,
  onChange,
  type,
  numeric = type === "number",
  min,
  max,
  step,
  className = "",
}: StyleInputProps): React.JSX.Element {
  // `useId` (not a slug of the label) — the slug was built from the *translated*
  // label, and in Persian "عرض حاشیه" and "شعاع گوشه" both collapsed to the same
  // all-hyphen id, leaving two fields sharing one DOM id in the same panel.
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(value ?? "");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setDraft(raw);
    if (!numeric) {
      onChange(raw);
      return;
    }
    // An empty or in-progress edit ("-", "1.") is not a value yet.
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) onChange(parsed);
  };

  const handleBlur = () => {
    if (draft === null) return;
    if (numeric && draft.trim() !== "") {
      const parsed = Number(draft);
      if (!Number.isNaN(parsed)) onChange(parsed);
    }
    setDraft(null);
  };

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="text-xs font-bold uppercase text-muted-foreground tracking-wide"
      >
        {label}
      </label>
      <Input
        id={inputId}
        name={inputId}
        type="text"
        inputMode={numeric ? "numeric" : undefined}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        className="w-full min-h-11 px-1.5 py-2 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
    </div>
  );
}
