import React from "react";
import { cn } from "@/lib/utils";

export interface CategoryColorChipProps {
  name: string;
  color: string;
  icon?: string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Soft tint category chip from a user-configured color (avoids solid hex + white text).
 */
export function CategoryColorChip({
  name,
  color,
  icon,
  className,
  size = "sm",
}: CategoryColorChipProps): React.ReactElement {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-bold",
        sizeClass,
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span>{name}</span>
    </span>
  );
}
