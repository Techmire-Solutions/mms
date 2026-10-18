import { useMemo } from "react";
import { Link } from "react-router-dom";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetCardHeader } from "@/components/app/WidgetCardHeader";
import { getOutstandingAmountForInvoice } from "@mms/shared";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { SearchBar } from "@/components/app/SearchBar";
import { ListPagination } from "@/components/app/ListPagination";
import { useLocalPagination } from "@/hooks/useLocalPagination";
import { ROUTES } from "@/lib/config/routes";
import { Badge } from "@/components/ui/badge";
import { OutstandingFeesTableMobileList } from "@/components/dashboard-widgets/OutstandingFeesTableMobileList";
import { OutstandingFeesTableDesktopBody } from "@/components/dashboard-widgets/OutstandingFeesTableDesktopBody";
import { useUnpaidInvoiceStudents } from "@/components/dashboard-widgets/useUnpaidInvoiceStudents";
import { MessageComposerLauncher } from "@/components/dashboard-widgets/MessageComposerLauncher";
import { buildOutstandingFeeRecipient } from "@/components/dashboard-widgets/OutstandingFeesTableParts";

export default function OutstandingFeesTable({ title }: { title?: string }) {
  const { t } = useTranslation();
  const { unpaidInvoices, studentMap } = useUnpaidInvoiceStudents();
  const { formatCurrency } = useFinanceCurrency();

  const { messagingTarget, openComposer, closeComposer, canWriteMessaging } =
    useMessageComposerState();

  const mappedRows = useMemo(() => {
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();

    return unpaidInvoices.map((invoice) => {
      const student = studentMap.get(String(invoice.studentId));
      const contact = student?.phone || "";
      const amount = getOutstandingAmountForInvoice(invoice);

      const due = new Date(invoice.dueDate);
      const diffMonths = Math.max(
        1,
        (nowYear - due.getFullYear()) * 12 + (nowMonth - due.getMonth()),
      );

      return {
        id: invoice.id,
        studentId: invoice.studentId,
        student: invoice.studentName,
        class: invoice.class || "",
        amount,
        months: diffMonths,
        contact,
        email: student?.email || "",
        dueDate: invoice.dueDate,
      };
    });
  }, [unpaidInvoices, studentMap]);

  const {
    searchQuery,
    currentPage,
    setCurrentPage,
    handleSearchChange,
    paginatedItems: paginatedRows,
    filteredItems: filteredRows,
    totalPages,
  } = useLocalPagination({
    items: mappedRows,
    pageSize: 5,
    searchFields: (row) => [row.student, row.class],
  });

  const totalUnpaid = unpaidInvoices.length;
  const listProps = useMemo(
    () => ({
      canWriteMessaging,
      formatCurrency,
      openComposer,
      t,
    }),
    [canWriteMessaging, formatCurrency, openComposer, t],
  );

  return (
    <WidgetCard ariaLabelledby="outstanding-fees-heading" accentColor="destructive">
      <WidgetCardHeader
        headingId="outstanding-fees-heading"
        icon={<AlertCircle className="w-4 h-4 shrink-0 text-destructive" aria-hidden="true" />}
        title={title || t("dashboard.widgets.outstandingPayments")}
        badge={
          <Badge
            as="span"
            pill
            tone="destructive"
            className="uppercase tracking-wider font-bold"
            aria-label={t("dashboard.widgets.studentsCount", { count: totalUnpaid })}
          >
            {t("dashboard.widgets.studentsCount", { count: totalUnpaid })}
          </Badge>
        }
        actions={
          canWriteMessaging && (
            <Button
              variant="link"
              className="min-h-11 h-auto shrink-0 p-0 text-sm font-bold"
              onClick={() => {
                if (filteredRows.length === 0) return;
                const recipients = filteredRows
                  .map(buildOutstandingFeeRecipient)
                  .filter((recipient) => Boolean(recipient.phone));
                if (recipients.length > 0) {
                  openComposer("sms", recipients);
                }
              }}
            >
              {t("dashboard.widgets.sendAllReminders")}
            </Button>
          )
        }
      />

      <div className="p-3 px-6 border-b border-border/40 flex items-center gap-2 bg-muted/10">
        <SearchBar
          placeholder={t("contacts.searchPlaceholder")}
          value={searchQuery}
          onChange={handleSearchChange}
          className="flex-1"
        />
      </div>

      <div className="space-y-3 p-3 md:hidden">
        <OutstandingFeesTableMobileList rows={paginatedRows} {...listProps} />
      </div>

      <OutstandingFeesTableDesktopBody rows={paginatedRows} {...listProps} />

      <footer className="px-5 py-3.5 border-t border-border/45 flex flex-wrap items-center justify-between gap-2 bg-muted/10 select-none">
        <Link
          to={ROUTES.finance}
          className="inline-flex min-h-11 items-center text-xs font-bold text-primary hover:underline"
        >
          {t("dashboard.widgets.viewAllOutstanding")}
        </Link>
        <ListPagination
          variant="compact"
          page={currentPage}
          total={totalPages}
          limit={1}
          onPageChange={setCurrentPage}
        />
      </footer>

      <MessageComposerLauncher messagingTarget={messagingTarget} onClose={closeComposer} />
    </WidgetCard>
  );
}
