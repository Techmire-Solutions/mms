import { LayoutDashboard, Package, Send, Gift } from "lucide-react";
import {
  HASANAT_MODULE_MANIFEST,
  type AppTranslationKey,
  type Denomination,
  type StockBatch,
  type Distribution,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export const SETUP_TAB_LABEL_KEYS: Record<
  (typeof HASANAT_MODULE_MANIFEST.setupSubTabs)[number],
  AppTranslationKey
> = {
  denominations: "hasanat.setup.denominations",
  preferences: "hasanat.setup.preferences",
  templates: "hasanat.setup.templates",
};

export function getHasanatSubTabs(t: TranslationFunction) {
  return [
    { id: "overview" as const, label: t("hasanat.tabs.overview"), icon: LayoutDashboard },
    { id: "stock" as const, label: t("hasanat.tabs.stock"), icon: Package },
    { id: "distribute" as const, label: t("hasanat.tabs.distribute"), icon: Send },
    { id: "redemptions" as const, label: t("hasanat.tabs.redemptions"), icon: Gift },
  ];
}

export function getHasanatSetupTabs(t: TranslationFunction) {
  return HASANAT_MODULE_MANIFEST.setupSubTabs.map((id) => ({
    id,
    label: t(SETUP_TAB_LABEL_KEYS[id]),
  }));
}

export function unwrapHasanatEnvelopes(
  denomsBody: unknown,
  batchesBody: unknown,
  distributionsBody: unknown,
) {
  const denomsEnvelope = denomsBody as Denomination[] | { denoms?: Denomination[] } | null;
  const batchesEnvelope = batchesBody as StockBatch[] | { batches?: StockBatch[] } | null;
  const distributionsEnvelope = distributionsBody as
    Distribution[] | { distributions?: Distribution[] } | null;

  return {
    denoms: Array.isArray(denomsEnvelope) ? denomsEnvelope : (denomsEnvelope?.denoms ?? []),
    batches: Array.isArray(batchesEnvelope) ? batchesEnvelope : (batchesEnvelope?.batches ?? []),
    distributions: Array.isArray(distributionsEnvelope)
      ? distributionsEnvelope
      : (distributionsEnvelope?.distributions ?? []),
  };
}

export function formatHasanatMessageRecipients(
  distList: Array<{ id: string; recipientName?: string; phone?: string; email?: string }>,
  defaultRecipientLabel: string,
) {
  return distList.map((distribution) => ({
    id: distribution.id,
    name: distribution.recipientName || defaultRecipientLabel,
    phone: distribution.phone || "",
    email: distribution.email || "",
  }));
}
