import { useState, useMemo, useCallback } from "react";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { WidgetCardHeader } from "@/components/ui/WidgetCardHeader";
import { AlertTriangle, Bell, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDateToIso, getOutstandingAmountForInvoice } from "@mms/shared";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useLocalPagination } from "@/hooks/useLocalPagination";
import {
  daysBetweenUtc,
  type OverdueStudent,
} from "@/components/dashboard-widgets/OverdueObligationsWidgetParts";
import { OverdueObligationsWidgetList } from "@/components/dashboard-widgets/OverdueObligationsWidgetList";
import { useUnpaidInvoiceStudents } from "@/components/dashboard-widgets/useUnpaidInvoiceStudents";
import { MessageComposerLauncher } from "@/components/dashboard-widgets/MessageComposerLauncher";

/** Overdue fee obligations follow-up widget — derived from finance invoices (Query). */
export default function OverdueObligationsWidget({ title }: { title?: string }) {
  const { t } = useTranslation();
  const { unpaidInvoices, students, studentMap } = useUnpaidInvoiceStudents();
  const { activeCurrency, formatCurrency } = useFinanceCurrency();

  const overdueStudents = useMemo(() => {
    const todayIso = formatDateToIso(new Date());
    const rows: OverdueStudent[] = [];

    unpaidInvoices.forEach((invoice) => {
      if (!invoice.dueDate || invoice.dueDate.slice(0, 10) >= todayIso) return;
      const amount = getOutstandingAmountForInvoice(invoice);
      if (amount <= 0) return;

      rows.push({
        id: String(invoice.studentId),
        name: invoice.studentName,
        obligationType: invoice.class || t("finance.metrics.overdue"),
        dueDate: invoice.dueDate,
        amount,
        currency: activeCurrency.code,
        daysOverdue: daysBetweenUtc(invoice.dueDate, todayIso),
      });
    });

    return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [unpaidInvoices, activeCurrency.code, t]);

  const [expanded, setExpanded] = useState(true);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
  const { messagingTarget, openComposer, closeComposer, canWriteMessaging } =
    useMessageComposerState();

  const {
    searchQuery,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    paginatedItems: paginatedStudents,
    filteredItems: filteredStudents,
    totalPages,
  } = useLocalPagination({
    items: overdueStudents,
    pageSize: 5,
    searchFields: (overdueStudent) => [overdueStudent.name, overdueStudent.obligationType],
  });

  const totalOverdue = useMemo(
    () => overdueStudents.reduce((sum, overdueStudent) => sum + overdueStudent.amount, 0),
    [overdueStudents],
  );

  const handleRemind = useCallback(
    (overdueStudent: OverdueStudent) => {
      const student = studentMap.get(String(overdueStudent.id));
      const phone = student?.phone || "";
      if (!phone) return;
      openComposer("sms", [
        {
          id: overdueStudent.id,
          name: overdueStudent.name,
          phone,
          email: student?.email || "",
          amount: overdueStudent.amount,
          dueDate: overdueStudent.dueDate,
        },
      ]);
      setRemindedIds((prev) => {
        const next = new Set(prev);
        next.add(overdueStudent.id);
        return next;
      });
    },
    [studentMap, openComposer],
  );

  const handleRemindAll = useCallback(() => {
    const recipients = filteredStudents
      .map((overdueStudent) => {
        const student = studentMap.get(String(overdueStudent.id));
        return {
          id: overdueStudent.id,
          name: overdueStudent.name,
          phone: student?.phone || "",
          email: student?.email || "",
          amount: overdueStudent.amount,
          dueDate: overdueStudent.dueDate,
        };
      })
      .filter((recipient) => Boolean(recipient.phone));

    if (recipients.length === 0) return;

    openComposer("sms", recipients);
    setRemindedIds((prev) => {
      const next = new Set(prev);
      recipients.forEach((recipient) => next.add(String(recipient.id)));
      return next;
    });
  }, [filteredStudents, studentMap, openComposer]);

  return (
    <WidgetCard ariaLabelledby="overdue-obligations-heading" accentColor="destructive">
      <WidgetCardHeader
        variant="destructive"
        headingId="overdue-obligations-heading"
        icon={
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15"
            aria-hidden="true"
          >
            <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
          </div>
        }
        title={title || t("dashboard.widgets.overdueObligations")}
        subtitle={`${t("dashboard.widgets.studentsCount", { count: filteredStudents.length })} · ${formatCurrency(totalOverdue)} ${t("finance.report.outstanding")}`}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canWriteMessaging && (
              <Button variant="destructive" size="caps" onClick={handleRemindAll}>
                <Bell className="w-3 h-3" aria-hidden="true" />
                {t("dashboard.widgets.remindAll")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-label={t("dashboard.widgets.toggleOverdueList")}
              className="rounded-lg hover:bg-destructive/15 text-destructive hover:text-destructive transition-colors shadow-none cursor-pointer"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        }
      />

      <OverdueObligationsWidgetList
        expanded={expanded}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        paginatedStudents={paginatedStudents}
        students={students}
        remindedIds={remindedIds}
        canWriteMessaging={canWriteMessaging}
        activeCurrencyCode={activeCurrency.code}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onRemind={handleRemind}
      />

      <MessageComposerLauncher messagingTarget={messagingTarget} onClose={closeComposer} />
    </WidgetCard>
  );
}
