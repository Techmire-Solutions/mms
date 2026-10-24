import { motion } from "framer-motion";
import { MessageCircle, Send } from "lucide-react";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { type useMessageComposerState } from "@/hooks/useMessageComposerState";
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
    <div className={className ?? "flex items-center justify-end gap-1.5"}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${t("contacts.whatsapp.open")} ${row.student}`}
        title={t("contacts.whatsapp.open")}
        className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shadow-none cursor-pointer"
        disabled={!row.contact}
        onClick={() => openComposer("whatsapp", recipient)}
      >
        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${t("dashboard.widgets.sendReminder")} ${row.student}`}
        title={t("dashboard.widgets.sendReminder")}
        className="rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shadow-none cursor-pointer"
        disabled={!row.contact}
        onClick={() => openComposer("sms", recipient)}
      >
        <Send className="w-3.5 h-3.5" aria-hidden="true" />
      </Button>
    </div>
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
