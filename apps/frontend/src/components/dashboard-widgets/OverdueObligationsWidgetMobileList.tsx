import React from "react";
import { motion } from "framer-motion";
import { Scale } from "lucide-react";
import { formatMoney, formatDate } from "@mms/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/ui/StatGrid";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  OverdueUrgencyBadge,
  OverdueRemindButton,
  type OverdueStudent,
} from "@/components/dashboard-widgets/OverdueObligationsWidgetParts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface OverdueObligationsWidgetMobileListProps {
  paginatedStudents: OverdueStudent[];
  students: Array<{ id: string | number; phone?: string | null }>;
  remindedIds: Set<string>;
  canWriteMessaging: boolean;
  activeCurrencyCode: string;
  onRemind: (overdueStudent: OverdueStudent) => void;
  t: TranslationFunction;
}

export function OverdueObligationsWidgetMobileList({
  paginatedStudents,
  students,
  remindedIds,
  canWriteMessaging,
  activeCurrencyCode,
  onRemind,
  t,
}: OverdueObligationsWidgetMobileListProps): React.ReactElement {
  const studentsById = (() => new Map(students.map((entry) => [String(entry.id), entry])))();

  if (paginatedStudents.length === 0) {
    return (
      <EmptyState
        title={t("finance.report.noInvoicesMatch")}
        compact
        icon={null}
        className="select-none"
      />
    );
  }

  return (
    <>
      {paginatedStudents.map((overdueStudent, index) => {
        const reminded = remindedIds.has(overdueStudent.id);
        const student = studentsById.get(String(overdueStudent.id));
        const hasPhone = Boolean(student?.phone);
        return (
          <motion.article
            key={`${overdueStudent.id}-${overdueStudent.dueDate}-${overdueStudent.amount}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: Math.min(index * 0.02, 0.25), duration: 0.2 }}
            className={`${WORK_SURFACE_INNER} space-y-3 p-3`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar
                  id={overdueStudent.id}
                  name={overdueStudent.name}
                  size="sm"
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-foreground m-0">
                    {overdueStudent.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Scale
                      className="w-3.5 h-3.5 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                    <p className="truncate text-xs text-muted-foreground m-0">
                      {overdueStudent.obligationType}
                    </p>
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold text-foreground tabular-nums">
                {formatMoney(overdueStudent.amount, overdueStudent.currency || activeCurrencyCode)}
              </span>
            </div>
            <StatGrid columns="1">
              <StatRow
                label={t("finance.columns.dueDate")}
                value={formatDate(overdueStudent.dueDate)}
                ddClassName="text-xs font-semibold tabular-nums"
                hint={t("dashboard.widgets.daysOverdue", { count: overdueStudent.daysOverdue })}
                hintClassName="text-destructive font-bold uppercase tracking-wide tabular-nums"
              />
            </StatGrid>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
              <OverdueUrgencyBadge daysOverdue={overdueStudent.daysOverdue} t={t} />
              {canWriteMessaging && (
                <OverdueRemindButton
                  overdueStudent={overdueStudent}
                  reminded={reminded}
                  hasPhone={hasPhone}
                  onRemind={onRemind}
                  t={t}
                />
              )}
            </div>
          </motion.article>
        );
      })}
    </>
  );
}
