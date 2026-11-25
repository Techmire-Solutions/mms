import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Alert } from "@/components/app/Alert";
import { Button } from "@mms/ui";

/** Shared load-failure state for platform settings panels. */
export function PlatformSettingsLoadError({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Alert
      tone="destructive"
      role="alert"
      description={t("platform.loadFailedHint")}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      }
    />
  );
}
