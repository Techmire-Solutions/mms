import { notify } from "@/lib/notify";
import { useFinanceCollectMutations } from "./useFinanceCollect";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { UseMessageComposerStateResult } from "@/hooks/useMessageComposerState";

export interface UseFinanceCollectActionsOptions {
  canWriteMessaging: boolean;
  openComposer: UseMessageComposerStateResult["openComposer"];
  t: TranslationFunction;
}

export function useFinanceCollectActions({
  canWriteMessaging,
  openComposer,
  t,
}: UseFinanceCollectActionsOptions) {
  const { collect, remind } = useFinanceCollectMutations();

  const handleCollectOverdue = async (): Promise<void> => {
    try {
      const result = await collect.mutateAsync({ applyLateFee: true });
      notify.success(
        t("finance.collect.success", {
          overdue: result.markedOverdue,
          lateFees: result.lateFeesApplied,
        }),
      );
    } catch (error) {
      notify.error(t("finance.collect.failed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRemindInvoices = async (): Promise<void> => {
    try {
      const result = await remind.mutateAsync({});
      if (result.recipients.length === 0) {
        notify.info(t("finance.collect.remindNone"));
        return;
      }
      notify.success(t("finance.collect.reminded", { count: result.reminded }));
      if (!canWriteMessaging) return;
      const hasPhone = result.recipients.some((recipient) => recipient.phone);
      openComposer(
        hasPhone ? "whatsapp" : "email",
        result.recipients.map((recipient) => ({
          id: recipient.id,
          name: recipient.name,
          phone: recipient.phone || "",
          email: recipient.email || "",
        })),
        { initialMessage: t("finance.collect.remindMessage") },
      );
    } catch (error) {
      notify.error(t("finance.collect.remindFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    collect,
    remind,
    collectPending: collect.isPending,
    remindPending: remind.isPending,
    handleCollectOverdue,
    handleRemindInvoices,
  };
}
