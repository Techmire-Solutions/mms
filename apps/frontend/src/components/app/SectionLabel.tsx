import React from "react";
import { cn } from "@/lib/utils";

export interface SectionLabelProps {
  children: React.ReactNode;
  as?: "h2" | "h3" | "h4" | "h5" | "span" | "p" | "legend" | "label" | "div";
  /** "muted" (default) | "foreground" | "primary" | "inherit" | custom toneClassName. */
  tone?: "muted" | "foreground" | "primary" | "inherit";
  /** Custom tone class overriding the tone color (e.g. a badge tone). */
  toneClassName?: string;
  /** "black" (default) | "bold" | "semibold". */
  weight?: "black" | "bold" | "semibold";
  /** "widest" (default) | "wider" | "wide". */
  tracking?: "widest" | "wider" | "wide";
  style?: React.CSSProperties;
  /** Association target when rendered as a `<label>`. */
  htmlFor?: string;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<SectionLabelProps["tone"]>, string> = {
  muted: "text-muted-foreground",
  foreground: "text-foreground",
  primary: "text-primary",
  inherit: "",
};

/** Small-caps section label — SSOT for the `text-xs font-(black|bold|semibold) uppercase tracking-*` micro-label chrome. */
export function SectionLabel({
  children,
  as: Tag = "span",
  tone = "muted",
  toneClassName,
  weight = "black",
  tracking = "widest",
  style,
  htmlFor,
  className,
}: SectionLabelProps): React.JSX.Element {
  const labelProps = Tag === "label" && htmlFor ? { htmlFor } : {};
  return (
    <Tag
      style={style}
      {...labelProps}
      className={cn(
        "text-xs uppercase",
        weight === "semibold" ? "font-semibold" : weight === "bold" ? "font-bold" : "font-black",
        tracking === "widest"
          ? "tracking-widest"
          : tracking === "wider"
            ? "tracking-wider"
            : "tracking-wide",
        toneClassName ?? TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
