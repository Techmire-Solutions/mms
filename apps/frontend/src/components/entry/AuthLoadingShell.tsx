import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { AuthCardShell, AuthPageFrame } from "@/components/entry/AuthPageShell";

/** Skeleton shell shown while tenant branding loads — matches auth card layout. */
export default function AuthLoadingShell(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <AuthPageFrame>
      <AuthCardShell
        header={
          <div className="space-y-3">
            <div className="mx-auto h-16 w-16 animate-pulse rounded-2xl bg-muted" aria-hidden />
            <div className="mx-auto h-4 w-32 animate-pulse rounded bg-muted" aria-hidden />
            <div className="mx-auto h-3 w-48 animate-pulse rounded bg-muted/70" aria-hidden />
          </div>
        }
      >
        <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
          <div className="h-11 animate-pulse rounded-lg bg-muted" aria-hidden />
          <div className="h-11 animate-pulse rounded-lg bg-muted" aria-hidden />
          <div className="h-11 animate-pulse rounded-xl bg-muted/80" aria-hidden />
          <span className="sr-only">{t("auth.loadingWorkspace")}</span>
        </div>
      </AuthCardShell>
    </AuthPageFrame>
  );
}
