import React from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";

export function AuthPageBackdrop(): React.JSX.Element {
  return <div className="pointer-events-none absolute inset-0 bg-background" aria-hidden />;
}

export function AuthCardShell({
  header,
  children,
  footer,
  className,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative z-elevated w-full max-w-toast",
        !reducedMotion && "animate-fade-in",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-2xl border border-foreground/12 bg-card shadow-surface-lg">
        <div className="border-b border-border/50 bg-muted/10 px-6 py-6 text-center sm:px-8">
          {header}
        </div>
        <div className="px-6 py-6 sm:px-8 sm:py-7">{children}</div>
        {footer ? (
          <div className="border-t border-border/40 px-6 py-4 text-center sm:px-8">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Outer page frame for pre-auth screens (platform + tenant). */
export function AuthPageFrame({
  children,
  dir: dirOverride,
}: {
  children: React.ReactNode;
  /** Force document direction (e.g. platform-themed host screens stay LTR). */
  dir?: "ltr" | "rtl";
}): React.JSX.Element {
  const { dir: translationDir } = useTranslation();
  const dir = dirOverride ?? translationDir;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      dir={dir}
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6"
    >
      <AuthPageBackdrop />
      {children}
    </main>
  );
}
