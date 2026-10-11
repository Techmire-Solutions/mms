import { Bell } from "lucide-react";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface OverdueStudent {
  id: string;
  name: string;
  obligationType: string;
  dueDate: string;
  amount: number;
  currency: string;
  daysOverdue: number;
}

export function daysBetweenUtc(dueDate: string, todayIso: string): number {
  const due = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(today)) return 0;
  return Math.max(0, Math.floor((today - due) / 86_400_000));
}

export function OverdueUrgencyBadge({
  daysOverdue,
  t,
}: {
  daysOverdue: number;
  t: TranslationFunction;
}) {
  const urgencyStatus = daysOverdue >= 30 ? "critical" : daysOverdue >= 14 ? "high" : "moderate";
  return (
    <StatusBadge
      status={urgencyStatus}
      config={{
        critical: {
          label: t("dashboard.widgets.urgency.critical"),
          cls: SEMANTIC_BADGE.destructive,
        },
        high: {
          label: t("dashboard.widgets.urgency.high"),
          cls: SEMANTIC_BADGE.warning,
        },
        moderate: {
          label: t("dashboard.widgets.urgency.moderate"),
          cls: SEMANTIC_BADGE.warning,
        },
      }}
      size="sm"
    />
  );
}

export function OverdueRemindButton({
  overdueStudent,
  reminded,
  hasPhone,
  onRemind,
  t,
  className,
}: {
  overdueStudent: OverdueStudent;
  reminded: boolean;
  hasPhone: boolean;
  onRemind: (overdueStudent: OverdueStudent) => void;
  t: TranslationFunction;
  className?: string;
}) {
  return (
    <Button
      variant={reminded ? "capsSuccess" : "capsAccent"}
      size="caps"
      onClick={() => onRemind(overdueStudent)}
      disabled={reminded || !hasPhone}
      aria-label={
        reminded
          ? t("dashboard.widgets.reminderSentTo", { name: overdueStudent.name })
          : t("dashboard.widgets.sendReminderTo", { name: overdueStudent.name })
      }
      className={className}
    >
      <Bell className="w-2.5 h-2.5" aria-hidden="true" />
      {reminded ? t("dashboard.widgets.sent") : t("dashboard.widgets.remind")}
    </Button>
  );
}
