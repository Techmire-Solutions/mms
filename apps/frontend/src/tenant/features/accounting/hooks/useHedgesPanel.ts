import { useState } from "react";
import { todayISO, type HedgeRelationship, type HedgeRelationshipCreate } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { HedgeAction, HedgeActionInput } from "@/tenant/features/accounting/lib/hedgeForms";
import {
  useCreateHedge,
  useHedges,
  usePostHedgeValuation,
  useReclassifyHedge,
  useSettleHedge,
} from "@/tenant/features/accounting/hooks/useHedges";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** State and actions for Setup → Hedge accounting (IFRS 9). */
export function useHedgesPanel() {
  const { t } = useTranslation();
  const hedges = useHedges();
  const create = useCreateHedge();
  const value = usePostHedgeValuation();
  const settle = useSettleHedge();
  const reclassify = useReclassifyHedge();
  const [designating, setDesignating] = useState(false);
  const [valuationDate, setValuationDate] = useState(todayISO());
  const [pending, setPending] = useState<{ action: HedgeAction; hedge: HedgeRelationship } | null>(
    null,
  );

  const handleCreate = async (hedge: HedgeRelationshipCreate): Promise<void> => {
    await create.mutateAsync(hedge);
    notify.success(t("accounting.settings.hedges.created"));
  };

  const handleValue = async (hedge: HedgeRelationship): Promise<void> => {
    try {
      const updated = await value.mutateAsync({ id: hedge.id, valuationDate });
      const latest = updated.valuations.findLast((record) => record.kind === "valuation");
      notify.success(
        t("accounting.settings.hedges.valued", { amount: latest?.instrumentValue ?? "0" }),
      );
    } catch (error) {
      notify.error(t("accounting.settings.hedges.valueFailed"), { description: errorText(error) });
    }
  };

  const handleAction = async (input: HedgeActionInput): Promise<void> => {
    if (!pending) return;
    try {
      if (pending.action === "settle") {
        await settle.mutateAsync({
          id: pending.hedge.id,
          settlementDate: input.date,
          settlementRate: input.rate,
          cashAccountId: input.accountId,
        });
      } else {
        await reclassify.mutateAsync({
          id: pending.hedge.id,
          date: input.date,
          targetAccountId: input.accountId,
        });
      }
      setPending(null);
      notify.success(t("accounting.settings.hedges.actionDone"));
    } catch (error) {
      notify.error(t("accounting.settings.hedges.actionFailed"), { description: errorText(error) });
    }
  };

  return {
    hedges: hedges.data ?? [],
    loading: hedges.isPending,
    loadError: hedges.isError,
    refetch: hedges.refetch,
    designating,
    setDesignating,
    handleCreate,
    valuationDate,
    setValuationDate,
    valuing: value.isPending,
    handleValue,
    pending,
    setPending,
    acting: settle.isPending || reclassify.isPending,
    handleAction,
  };
}
