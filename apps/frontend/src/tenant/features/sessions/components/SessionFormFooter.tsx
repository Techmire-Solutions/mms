import React from "react";
import { toTitleCase, type AppTranslationKey } from "@mms/shared";
import { FormFooterEntityChip, FormFooterErrorChip } from "@/components/app/FormFooterChip";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";

export interface SessionFormFooterProps {
  sessionName?: string;
  sessionType?: string;
  sessionStatus?: string;
  nameRequiredLabel: string;
}

export function SessionFormFooter({
  sessionName,
  sessionType,
  sessionStatus,
  nameRequiredLabel,
}: SessionFormFooterProps): React.JSX.Element {
  const { t } = useTranslation();
  const statusLabel = (() => {
    const status = sessionStatus || "active";
    const translationKey = `sessions.status.${status}` as AppTranslationKey;
    const translated = t(translationKey);
    return translated === translationKey ? toTitleCase(status) : translated;
  })();

  if (!sessionName) {
    return <FormFooterErrorChip>{nameRequiredLabel}</FormFooterErrorChip>;
  }

  const statusTone: BadgeTone =
    sessionStatus === "active" ? "success" : sessionStatus === "completed" ? "info" : "muted";

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <FormFooterEntityChip>{sessionName}</FormFooterEntityChip>
      <div className="flex items-center gap-1.5">
        <Badge as="span" tone="primary" size="sm">
          {sessionType}
        </Badge>
        <Badge as="span" tone={statusTone} size="sm">
          {statusLabel}
        </Badge>
      </div>
    </div>
  );
}
