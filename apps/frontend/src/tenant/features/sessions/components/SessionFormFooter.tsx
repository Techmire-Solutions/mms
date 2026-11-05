import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { normalizeSessionStatus } from "@mms/shared";
import { FormFooterEntityChip } from "@/components/app/FormFooterChip";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";

export interface SessionFormFooterProps {
  sessionName?: string;
  sessionType?: string;
  sessionStatus?: string;
  startDate?: string;
  endDate?: string;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "muted",
  open: "info",
  in_progress: "success",
  completed: "info",
  cancelled: "destructive",
  archived: "muted",
};

export function SessionFormFooter({
  sessionName,
  sessionType,
  sessionStatus,
  startDate,
  endDate,
}: SessionFormFooterProps): React.JSX.Element {
  const { t } = useTranslation();
  const status = normalizeSessionStatus(sessionStatus);
  const statusLabel = t(`sessions.lifecycle.${status}` as AppTranslationKey);
  if (!sessionName?.trim() || !startDate || !endDate) {
    return (
      <Badge as="span" tone="warning" size="sm">
        {t("sessions.form.completeRequired")}
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <FormFooterEntityChip>{sessionName}</FormFooterEntityChip>
      <div className="flex items-center gap-1.5">
        {sessionType?.trim() ? (
          <Badge as="span" tone="primary" size="sm">
            {sessionType}
          </Badge>
        ) : null}
        <Badge as="span" tone={STATUS_TONE[status] ?? "muted"} size="sm">
          {statusLabel}
        </Badge>
      </div>
    </div>
  );
}
