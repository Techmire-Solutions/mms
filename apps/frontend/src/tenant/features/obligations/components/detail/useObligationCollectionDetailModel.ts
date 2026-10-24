import { useState, useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { DEFAULT_CURRENCIES } from "@mms/shared";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
  WakalaType,
  ObligationDistribution,
} from "@/lib/data/obligationsData";
import {
  useMergedObligationContacts,
  useMergedObligationUsers,
} from "@/tenant/features/obligations/hooks/useObligationLookups";

export interface UseObligationCollectionDetailModelProps {
  collection: ObligationCollection;
  obligationTypes: ObligationType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  distributions: ObligationDistribution[];
  wakalaTypes: WakalaType[];
}

export function useObligationCollectionDetailModel({
  collection,
  obligationTypes,
  reps,
  mujtahids,
  distributions,
  wakalaTypes,
}: UseObligationCollectionDetailModelProps) {
  const { t } = useTranslation();
  const currencies = DEFAULT_CURRENCIES;

  const [showPrint, setShowPrint] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorFromPrint, setEditorFromPrint] = useState(false);

  const contactIds = useMemo(
    () => [collection.sender_id, collection.reference_id],
    [collection.sender_id, collection.reference_id],
  );
  const userIds = useMemo(() => [collection.received_by], [collection.received_by]);

  const contacts = useMergedObligationContacts(contactIds);
  const users = useMergedObligationUsers(userIds);

  const distributionTypeConfig = useMemo<Record<string, StatusBadgeConfigItem>>(
    () => ({
      Income: { label: t("obligations.distribution.income"), cls: SEMANTIC_BADGE.success },
      Liability: { label: t("obligations.distribution.liability"), cls: SEMANTIC_BADGE.info },
    }),
    [t],
  );

  const paymentModeConfig = useMemo<Record<string, StatusBadgeConfigItem>>(
    () => ({
      Cash: { label: t("obligations.paymentMode.cash"), cls: SEMANTIC_BADGE.warning },
      Online: { label: t("obligations.paymentMode.online"), cls: SEMANTIC_BADGE.info },
    }),
    [t],
  );

  const sender = useMemo(
    () => contacts.find((contact) => String(contact.id) === String(collection.sender_id)),
    [contacts, collection.sender_id],
  );
  const reference = useMemo(
    () =>
      collection.reference_id
        ? contacts.find((c) => String(c.id) === String(collection.reference_id))
        : null,
    [contacts, collection.reference_id],
  );
  const currency = useMemo(
    () => currencies.find((c) => c.id === collection.currency_id),
    [currencies, collection.currency_id],
  );
  const user = useMemo(
    () => users.find((u) => String(u.id) === String(collection.received_by)),
    [users, collection.received_by],
  );
  const rep = useMemo(
    () => reps.find((r) => r.id === collection.mujtahid_representative_id),
    [reps, collection.mujtahid_representative_id],
  );
  const mujtahid = useMemo(
    () => (rep ? mujtahids.find((m) => m.id === rep.mujtahid_id) : null),
    [rep, mujtahids],
  );
  const obType = useMemo(
    () => obligationTypes.find((o) => o.id === collection.obligation_type_id),
    [obligationTypes, collection.obligation_type_id],
  );

  const wakalaType = useMemo(
    () =>
      wakalaTypes.find(
        (w) =>
          w.obligation_type_id === collection.obligation_type_id &&
          w.mujtahid_representative_id === collection.mujtahid_representative_id,
      ),
    [wakalaTypes, collection.obligation_type_id, collection.mujtahid_representative_id],
  );

  const dists = useMemo(
    () => (wakalaType ? distributions.filter((d) => d.wakala_type_id === wakalaType.id) : []),
    [wakalaType, distributions],
  );

  const { totalPct, totalAmount } = useMemo(() => {
    const pct = dists.reduce((sum, d) => sum + (Number(d.percentage) || 0), 0);
    const amt = (collection.amount * pct) / 100;
    return { totalPct: pct, totalAmount: amt };
  }, [dists, collection.amount]);

  const isArchived = Boolean(collection.deletedAt);

  return {
    t,
    currency,
    sender,
    reference,
    user,
    rep,
    mujtahid,
    obType,
    wakalaType,
    dists,
    totalPct,
    totalAmount,
    isArchived,
    distributionTypeConfig,
    paymentModeConfig,
    showPrint,
    setShowPrint,
    showEditor,
    setShowEditor,
    editorFromPrint,
    setEditorFromPrint,
  };
}
