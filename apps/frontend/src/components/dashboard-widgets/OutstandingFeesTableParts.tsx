import { motion } from "framer-motion";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { type useMessageComposerState } from "@/hooks/useMessageComposerState";
import { EntityMessagingIconActions } from "@/components/app/EntityMessagingActions";
import { StatusBadge } from "@/components/app/StatusBadge";
import { TableRow } from "@/components/ui/table";

export const MotionTableRow = motion.create(TableRow);

export interface OutstandingFeeRow {
  id: string;
  studentId: string;
  student: string;
  class: string;
  amount: number;
  months: number;
  contact: string;
  email: string;
  dueDate: string;
}

export type OpenComposer = ReturnType<typeof useMessageComposerState>["openComposer"];

export type OutstandingFeeRecipientRow = Pick<
  OutstandingFeeRow,
  "studentId" | "student" | "contact" | "email" | "amount" | "dueDate"
>;

/** Build a messaging recipient from an outstanding-fee row. Shared by the
 *  row messaging actions and the "send all reminders" bulk action. */
export function buildOutstandingFeeRecipient(row: OutstandingFeeRecipientRow) {
  return {
    id: row.studentId,
    name: row.student,
    phone: row.contact,
    email: row.email,
    amount: row.amount,
    dueDate: row.dueDate,
  };
}

export function OutstandingFeeMessagingActions({
  row,
  openComposer,
  t,
  className,
}: {
  row: OutstandingFeeRecipientRow;
  openComposer: OpenComposer;
  t: TranslationFunction;
  className?: string;
}) {
  const recipient = [buildOutstandingFeeRecipient(row)];

  return (
    <EntityMessagingIconActions
      labels={{
        whatsapp: t("contacts.whatsapp.open"),
        sms: t("dashboard.widgets.sendReminder"),
      }}
      whatsappAriaLabel={`${t("contacts.whatsapp.open")} ${row.student}`}
      smsAriaLabel={`${t("dashboard.widgets.sendReminder")} ${row.student}`}
      primaryPhone={row.contact}
      showCall={false}
      showEmail={false}
      messagingEnabled={Boolean(row.contact)}
      onWhatsApp={() => openComposer("whatsapp", recipient)}
      onSms={() => openComposer("sms", recipient)}
      className={className ?? "justify-end"}
    />
  );
}

export function OutstandingFeeOverdueBadge({
  months,
  t,
}: {
  months: number;
  t: TranslationFunction;
}) {
  return (
    <StatusBadge
      status={months >= 3 ? "overdue" : "warning"}
      config={{
        overdue: {
          label: t("dashboard.widgets.overdueStatus", { count: months }),
          cls: SEMANTIC_BADGE.destructive,
        },
        warning: {
          label: t("dashboard.widgets.overdueStatus", { count: months }),
          cls: SEMANTIC_BADGE.warning,
        },
      }}
      size="sm"
    />
  );
}
