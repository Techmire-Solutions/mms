import React from "react";
import { CalendarDays } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { WorkingDaysPicker } from "@/components/common/WorkingDaysPicker";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionFormDraft } from "./sessionFormShared";

export interface SessionScheduleSectionProps {
  sessionDraft: SessionFormDraft;
  onDraftChange: (patch: Partial<SessionFormDraft>) => void;
}

/** Optional weekly teaching days for this session (e.g. weekend-only short courses). */
export function SessionScheduleSection({ sessionDraft, onDraftChange }: SessionScheduleSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <SectionCard accentColor="primary" icon={CalendarDays} title={t("sessions.form.sectionSchedule")} className="shadow-sm text-start">
      <WorkingDaysPicker
        label={t("sessions.form.workingDays")}
        description={t("sessions.form.workingDaysHint")}
        value={sessionDraft.workingDays ?? []}
        onChange={(workingDays) => onDraftChange({ workingDays })}
      />
    </SectionCard>
  );
}
