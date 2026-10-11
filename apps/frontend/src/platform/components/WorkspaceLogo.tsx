import React from "react";

interface WorkspaceLogoProps {
  logoUrl?: string | null;
  madrasaName: string;
  className?: string;
}

/** Madrasa logo with accessible alt text, or default mark when no logo URL. */
function WorkspaceLogo({
  logoUrl,
  madrasaName,
  className = "rounded-lg",
}: WorkspaceLogoProps): React.JSX.Element {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={madrasaName}
        loading="lazy"
        decoding="async"
        className={`h-10 w-10 shrink-0 object-contain bg-background border border-border ${className}`}
      />
    );
  }

  return (
    <div
      className={`h-10 w-10 shrink-0 bg-primary/15 flex items-center justify-center ${className}`}
      role="img"
      aria-label={madrasaName}
    >
      <span className="text-primary font-display text-base font-bold" aria-hidden>
        م
      </span>
    </div>
  );
}

export default WorkspaceLogo;
