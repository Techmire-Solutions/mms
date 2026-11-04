import { useState } from "react";
import {
  applyTitleCaseToContact,
  getDuplicateConfidenceBadgeStyle,
  mergeContacts,
  type AppTranslationKey,
  type Contact,
} from "@mms/shared";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactsDuplicatePairs } from "@/tenant/features/contacts/hooks/useContactsAnalyticsQueries";
import type { ContactsDuplicatePairsPageResult } from "@mms/shared";
import { DUPLICATE_REASON_I18N } from "@/lib/contacts/contactI18n";
import { notify } from "@/lib/notify";
import { reportClientError } from "@/lib/clientErrorReporting";
import type { DuplicatePair } from "@/tenant/features/contacts/lib/duplicateDetectionTypes";
import { runBatchMerge } from "@/tenant/features/contacts/lib/duplicateBatchMerge";

function mapPairToViewModel(
  pair: {
    id: string;
    confidence: number;
    reasonKey: keyof typeof DUPLICATE_REASON_I18N;
    contacts: [Contact, Contact];
  },
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
): DuplicatePair {
  const i18nKey = DUPLICATE_REASON_I18N[pair.reasonKey];
  return {
    id: pair.id,
    confidence: pair.confidence,
    reason: i18nKey ? t(i18nKey) : pair.reasonKey,
    contacts: pair.contacts,
  };
}

export type DuplicateTierFilter = "all" | "high" | "medium" | "low";

export function useDuplicateDetectionState({
  onMerge,
}: {
  onMerge: (
    keepId: string | number,
    deleteId: string | number,
    mergedData: Contact,
    keepUpdatedAt?: string,
  ) => Promise<void>;
}) {
  const { prefs, fieldConfigVersion } = useContactConfig();
  const { t } = useTranslation();
  /** Merge writes carry the active blueprint version so a stale preview is rejected. */
  const withBlueprintVersion = (contact: Contact): Contact =>
    ({ ...contact, _blueprintId: String(fieldConfigVersion) }) as Contact;
  const [dupPage, setDupPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<DuplicateTierFilter>("all");

  const {
    data,
    isLoading: pairsLoading,
    isFetching: pairsFetching,
    isError: pairsError,
    isSuccess: pairsSuccess,
    refetch: refetchPairs,
  } = useContactsDuplicatePairs({
    page: dupPage,
    limit: 50,
  });
  const serverPairs = data as ContactsDuplicatePairsPageResult | undefined;
  const [dismissedPairIds, setDismissedPairIds] = useState<Set<string>>(new Set());
  const [mergedPairIds, setMergedPairIds] = useState<Set<string>>(new Set());
  const [keepIndex, setKeepIndex] = useState<Record<string, number>>({});
  const [merging, setMerging] = useState<DuplicatePair | null>(null);
  const [loadedPairs, setLoadedPairs] = useState<DuplicatePair[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [batchMerging, setBatchMerging] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const [prevServerPairs, setPrevServerPairs] = useState(serverPairs);
  const [prevDupPage, setPrevDupPage] = useState(dupPage);
  if (prevServerPairs !== serverPairs || prevDupPage !== dupPage) {
    setPrevServerPairs(serverPairs);
    setPrevDupPage(dupPage);
    if (serverPairs?.pairs) {
      const mappedPairs = serverPairs.pairs.map((pair) => mapPairToViewModel(pair, t));
      setLoadedPairs((prev) => {
        if (dupPage <= 1) return mappedPairs;
        const byId = new Map(prev.map((previousPair) => [previousPair.id, previousPair]));
        for (const mappedPair of mappedPairs) byId.set(mappedPair.id, mappedPair);
        return [...byId.values()];
      });
    }
  }

  const detectedPairs = (() => {
    if (pairsError) return [];
    if (pairsSuccess || loadedPairs.length > 0) return loadedPairs;
    return [];
  })() as DuplicatePair[];

  const handleLoadMoreDuplicates = () => {
    if (serverPairs?.hasMore) setDupPage((currentPage) => currentPage + 1);
  };

  const unhandledPairs = (() =>
    detectedPairs.filter(
      (pair) => !dismissedPairIds.has(pair.id) && !mergedPairIds.has(pair.id),
    ))() as DuplicatePair[];

  const tierCounts = (() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const pair of unhandledPairs) {
      const { labelTier } = getDuplicateConfidenceBadgeStyle(pair.confidence, prefs);
      if (labelTier === "high") high++;
      else if (labelTier === "medium") medium++;
      else low++;
    }
    return { all: unhandledPairs.length, high, medium, low };
  })();

  const activePairs = (() => {
    const query = searchQuery.trim().toLowerCase();
    return unhandledPairs.filter((pair) => {
      if (tierFilter !== "all") {
        const { labelTier } = getDuplicateConfidenceBadgeStyle(pair.confidence, prefs);
        if (labelTier !== tierFilter) return false;
      }
      if (!query) return true;

      return pair.contacts.some((contact) => {
        const name =
          `${contact.name || ""} ${contact.firstName || ""} ${contact.lastName || ""}`.toLowerCase();
        if (name.includes(query)) return true;
        const cnic = (contact.cnic || "").toLowerCase();
        if (cnic.includes(query)) return true;
        const phones = (contact.phones || []).map((p) => p.number).join(" ");
        if (phones.includes(query)) return true;
        const emails = (contact.emails || [])
          .map((e) => e.address)
          .join(" ")
          .toLowerCase();
        if (emails.includes(query)) return true;
        return false;
      });
    });
  })() as DuplicatePair[];

  const totalPairs = serverPairs?.total ?? detectedPairs.length;

  const highConfidencePairs = activePairs.filter(
    (pair) => pair.confidence >= 95 || (pair.confidence >= 0.95 && pair.confidence <= 1),
  );

  const handleBatchMergeHighConfidence = async (): Promise<void> => {
    if (batchMerging || highConfidencePairs.length === 0) return;
    setBatchMerging(true);
    try {
      // Per-pair isolation: one conflict must not discard the pairs that already
      // merged, and a contact appearing in two pairs is merged only once.
      const result = await runBatchMerge(
        highConfidencePairs,
        keepIndex,
        async (keep, other) => {
          const mergedResult = withBlueprintVersion(
            applyTitleCaseToContact(mergeContacts(keep, other)),
          );
          await onMerge(keep.id, other.id, mergedResult, keep.updatedAt);
        },
        (error) => reportClientError(error, { scope: "contacts.duplicate_batch_merge" }),
      );

      if (result.mergedPairIds.length > 0) {
        setMergedPairIds((prev) => new Set([...prev, ...result.mergedPairIds]));
      }

      if (result.failed === 0) {
        notify.success(t("contacts.duplicates.batchMergeSuccess", { count: result.merged }));
      } else {
        notify.warning(
          t("contacts.duplicates.batchMergePartial", {
            merged: result.merged,
            total: highConfidencePairs.length,
            failed: result.failed,
          }),
        );
      }
      setBatchConfirmOpen(false);
    } finally {
      setBatchMerging(false);
    }
  };

  const handleMergeConfirm = async (customMerged?: Contact): Promise<void> => {
    if (!merging || confirming) return;
    const pair = merging;
    const selectedKeepIndex = keepIndex[pair.id] ?? 0;
    const keep = pair.contacts[selectedKeepIndex];
    const other = pair.contacts[1 - selectedKeepIndex];

    const mergedRaw = customMerged ?? mergeContacts(keep, other);
    const mergedResult = withBlueprintVersion(applyTitleCaseToContact(mergedRaw));
    setConfirming(true);
    try {
      await onMerge(keep.id, other.id, mergedResult, keep.updatedAt);
      setMergedPairIds((prev) => new Set(prev).add(pair.id));
      setMerging(null);
    } catch (err) {
      notify.error(t("contacts.saveFailed"));
      reportClientError(err, { scope: "contacts.duplicate_merge_confirm" });
    } finally {
      setConfirming(false);
    }
  };

  const handleDismiss = (pairId: string): void => {
    setDismissedPairIds((prev) => new Set(prev).add(pairId));
  };

  const setKeepIndexForPair = (pairId: string, contactIndex: number): void => {
    setKeepIndex((previousSelection) => ({ ...previousSelection, [pairId]: contactIndex }));
  };

  return {
    prefs,
    pairsLoading,
    pairsFetching,
    pairsError,
    refetchPairs,
    hasMore: Boolean(serverPairs?.hasMore),
    activePairs,
    totalPairs,
    tierCounts,
    searchQuery,
    setSearchQuery,
    tierFilter,
    setTierFilter,
    keepIndex,
    merging,
    confirming,
    totalMerged: mergedPairIds.size,
    highConfidenceCount: highConfidencePairs.length,
    batchMerging,
    batchConfirmOpen,
    setBatchConfirmOpen,
    handleBatchMergeHighConfidence,
    setMerging,
    handleLoadMoreDuplicates,
    handleMergeConfirm,
    handleDismiss,
    setKeepIndexForPair,
  };
}
