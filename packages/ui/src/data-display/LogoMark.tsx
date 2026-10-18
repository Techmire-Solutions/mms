import React from "react";
import { cn } from "../utils";

export interface LogoMarkProps {
  size?: "sm" | "md" | "lg";
  src?: string;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
}

const SIZE_STYLES: Record<"sm" | "md" | "lg", { style: string; px: number }> = {
  sm: { style: "h-9 w-9 rounded-xl p-1 shadow-sm shadow-primary/10", px: 36 },
  md: { style: "h-14 w-14 rounded-xl p-1.5 shadow-md shadow-primary/10", px: 56 },
  lg: {
    style:
      "mx-auto h-20 w-20 rounded-2xl p-2 shadow-xl shadow-primary/15 transition-transform hover:scale-105",
    px: 80,
  },
};

/**
 * Universal brand logo mark primitive.
 * Presents product/platform branding with accessible alt text and responsive sizing.
 * Adheres to modern-web-guidance: optimize-image-priority.
 */
export function LogoMark({
  size = "lg",
  src = "/platform-logo.webp",
  alt = "Product Logo",
  className,
  loading = "eager",
  decoding = "async",
  fetchPriority = "high",
}: LogoMarkProps): React.JSX.Element {
  const sizeConfig = SIZE_STYLES[size] ?? SIZE_STYLES.lg;

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-card border border-primary/40 select-none overflow-hidden",
        sizeConfig.style,
        className,
      )}
      aria-hidden
    >
      <img
        src={src}
        alt={alt}
        width={sizeConfig.px}
        height={sizeConfig.px}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export const PlatformLogoMark = LogoMark;
