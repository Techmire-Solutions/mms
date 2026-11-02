/**
 * @file TemplateSaveConflictBanner.tsx
 * @description Banner shown when a template save lost a race with another admin.
 * Saving stays blocked until the user reloads the latest layout.
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateSaveConflictBannerProps {
  onReload: () => void | Promise<unknown>;
  t: TranslationFunction;
}

export function TemplateSaveConflictBanner({
  onReload,
  t,
}: TemplateSaveConflictBannerProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="m-0 flex-1 leading-relaxed">{t("templateEditor.saveConflict")}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => void onReload()}
      >
        {t("templateEditor.reloadLatest")}
      </Button>
    </div>
  );
}
