import React, { useState, useEffect } from "react";
import { cn } from "../utils";

export type WorkspaceLogoSize = "sm" | "md" | "lg";

export interface WorkspaceLogoProps {
  /** Public URL for the workspace or institution logo. */
  logoUrl?: string | null;
  /** Accessible workspace or institution name for alt text & aria-label. */
  madrasaName: string;
  /** Size token — `sm` (32px), `md` (40px, default), `lg` (48px). */
  size?: WorkspaceLogoSize;
  /** Custom fallback glyph/text when logoUrl is absent or fails to load (defaults to "م"). */
  fallbackText?: string;
  /** Additional styling classes merged onto container/image. */
  className?: string;
  /** Image loading strategy — defaults to "lazy", automatically elevated to "eager" when fetchPriority="high". */
  loading?: "lazy" | "eager";
  /** Image decoding mode — defaults to "async". */
  decoding?: "async" | "auto" | "sync";
  /** Explicit resource prioritization for LCP candidate logos. */
  fetchPriority?: "high" | "low" | "auto";
}

const SIZE_CONFIG: Record<
  WorkspaceLogoSize,
  { dimensions: string; textClass: string; imgPx: number }
> = {
  sm: { dimensions: "h-8 w-8", textClass: "text-sm", imgPx: 32 },
  md: { dimensions: "h-10 w-10", textClass: "text-base", imgPx: 40 },
  lg: { dimensions: "h-12 w-12", textClass: "text-lg", imgPx: 48 },
};

/**
 * Universal Madrasa / Workspace Logo component with accessible alt-text
 * and automatic fallback glyph ("م" or custom initials) when no logo URL is present.
 * Adheres to modern-web-guidance: optimize-image-priority.
 */
export function WorkspaceLogo({
  logoUrl,
  madrasaName,
  size = "md",
  fallbackText = "م",
  className = "rounded-lg",
  loading,
  decoding = "async",
  fetchPriority,
}: WorkspaceLogoProps): React.JSX.Element {
  const [imgError, setImgError] = useState(false);
  const sizeCfg = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  if (logoUrl && !imgError) {
    // Modern Web Guidance: optimize-image-priority — never combine loading="lazy" with fetchpriority="high"
    const resolvedLoading = loading ?? (fetchPriority === "high" ? "eager" : "lazy");

    return (
      <img
        src={logoUrl}
        alt={madrasaName}
        width={sizeCfg.imgPx}
        height={sizeCfg.imgPx}
        loading={resolvedLoading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        onError={() => setImgError(true)}
        className={cn(
          sizeCfg.dimensions,
          "shrink-0 object-contain bg-background border border-border",
          className,
        )}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={madrasaName}
      className={cn(
        sizeCfg.dimensions,
        "shrink-0 bg-primary/15 flex items-center justify-center",
        className,
      )}
    >
      <span
        className={cn("text-primary font-display font-bold", sizeCfg.textClass)}
        aria-hidden="true"
      >
        {fallbackText}
      </span>
    </div>
  );
}

export default WorkspaceLogo;
