import React from "react";
import { cn } from "@/lib/utils";

export interface BiDiTextProps {
  /**
   * The string being rendered. Used for the `title` attribute so the full value
   * stays reachable when the element truncates.
   */
  children: React.ReactNode;
  /**
   * Explicit direction. Defaults to `auto`, which resolves from the first strong
   * character in the content — exactly what user-generated text needs.
   */
  dir?: "auto" | "ltr" | "rtl";
  /** Rendered as this element. Defaults to `span`. */
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4";
  className?: string;
  /** Adds `title` from the raw text (only meaningful for plain-string children). */
  titleFromContent?: boolean;
}

/**
 * Renders user-generated text with `dir="auto"` so its base direction comes from
 * its own first strong character rather than the surrounding UI.
 *
 * MMS ships four scripts (en/ar/ur/fa) and the whole layout is BiDi-clean, but
 * that only controlled the *layout*: a Latin-script name inside the RTL UI — or an
 * Urdu name inside the English UI — still rendered with the wrong base direction,
 * which moves trailing punctuation to the wrong side and reorders adjacent
 * numbers. Names, addresses, notes and other operator-entered values come from
 * people who do not know or care what language the UI is in.
 *
 * Use it for anything a human typed. Do NOT use it for translated copy: `t()`
 * output already matches the document direction.
 */
export function BiDiText({
  children,
  dir = "auto",
  as: Tag = "span",
  className,
  titleFromContent = false,
}: BiDiTextProps): React.JSX.Element {
  const title =
    titleFromContent && typeof children === "string" && children.length > 0 ? children : undefined;

  return (
    <Tag dir={dir} title={title} className={cn("min-w-0", className)}>
      {children}
    </Tag>
  );
}
