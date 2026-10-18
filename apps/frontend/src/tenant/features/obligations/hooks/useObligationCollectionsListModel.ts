import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
} from "@/lib/data/obligationsData";
import { useDebounce } from "@/hooks/useDebounce";
import { useMergedObligationContacts } from "@/tenant/features/obligations/hooks/useObligationLookups";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

export interface UseObligationCollectionsListModelProps {
  collections: ObligationCollection[];
  obligationTypes: ObligationType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  selectedIds?: string[];
  showDeleted?: boolean;
  onFilteredCountChange?: (count: number) => void;
  onClearSelection?: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
}

export function useObligationCollectionsListModel({
  collections,
  obligationTypes,
  reps,
  mujtahids,
  selectedIds = [],
  showDeleted = false,
  onFilteredCountChange,
  onClearSelection,
  onDelete,
  onRestore: _onRestore,
  onBulkDelete,
  onBulkRestore,
}: UseObligationCollectionsListModelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [printCollection, setPrintCollection] = useState<ObligationCollection | null>(null);
  const [editorCollection, setEditorCollection] = useState<ObligationCollection | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [pendingTrashId, setPendingTrashId] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const contactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const collection of collections) {
      if (collection.sender_id) ids.add(collection.sender_id);
      if (collection.reference_id) ids.add(collection.reference_id);
    }
    return Array.from(ids);
  }, [collections]);
  const contacts = useMergedObligationContacts(contactIds);

  const contactsMap = useMemo(
    () => new Map(contacts.filter(Boolean).map((c) => [String(c.id), c])),
    [contacts],
  );
  const repsMap = useMemo(
    () => new Map(reps.filter(Boolean).map((r) => [String(r.id), r])),
    [reps],
  );
  const mujtahidsMap = useMemo(
    () => new Map(mujtahids.filter(Boolean).map((m) => [String(m.id), m])),
    [mujtahids],
  );
  const obTypesMap = useMemo(
    () => new Map(obligationTypes.filter(Boolean).map((o) => [String(o.id), o])),
    [obligationTypes],
  );

  const getContact = useCallback(
    (contactId?: string | number | null) =>
      contactId != null ? contactsMap.get(String(contactId)) : undefined,
    [contactsMap],
  );
  const getRep = useCallback((repId: string) => repsMap.get(repId), [repsMap]);
  const getMujtahid = useCallback(
    (repId: string) => {
      const rep = getRep(repId);
      return rep ? mujtahidsMap.get(rep.mujtahid_id) : null;
    },
    [getRep, mujtahidsMap],
  );
  const getObligationType = useCallback(
    (obligationTypeId: string) => obTypesMap.get(obligationTypeId),
    [obTypesMap],
  );

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return collections.filter((collection) => {
      if (typeFilter !== "all" && collection.obligation_type_id !== typeFilter) return false;
      if (query) {
        const receipt = collection.receipt_no.toLowerCase();
        const senderContact = getContact(collection.sender_id);
        const refContact = getContact(collection.reference_id);
        const senderName = senderContact?.name?.toLowerCase() || "";
        const senderPhone = senderContact?.phone?.toLowerCase() || "";
        const refName = refContact?.name?.toLowerCase() || "";
        if (
          !receipt.includes(query) &&
          !senderName.includes(query) &&
          !senderPhone.includes(query) &&
          !refName.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [collections, typeFilter, debouncedSearch, getContact]);

  useEffect(() => {
    onFilteredCountChange?.(filtered.length);
  }, [filtered.length, onFilteredCountChange]);

  const paymentModeConfig = useMemo(
    () => ({
      Cash: { label: t("obligations.paymentMode.cash"), cls: SEMANTIC_BADGE.warning },
      Online: { label: t("obligations.paymentMode.online"), cls: SEMANTIC_BADGE.info },
    }),
    [t],
  ) as Record<string, StatusBadgeConfigItem>;

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((col) => selectedSet.has(col.id));
  const someVisibleSelected =
    selectedSet.size > 0 && filtered.some((col) => selectedSet.has(col.id));

  useEffect(() => {
    onClearSelection?.();
  }, [search, typeFilter, onClearSelection]);

  const confirmRowTrash = async (): Promise<void> => {
    if (!pendingTrashId) return;
    try {
      await onDelete?.(pendingTrashId);
    } finally {
      setPendingTrashId(null);
    }
  };

  const confirmBulkTrash = async (): Promise<void> => {
    try {
      if (showDeleted) await onBulkRestore?.(selectedIds);
      else await onBulkDelete?.(selectedIds);
    } finally {
      onClearSelection?.();
      setConfirmBulkOpen(false);
    }
  };

  return {
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    printCollection,
    setPrintCollection,
    editorCollection,
    setEditorCollection,
    showEditor,
    setShowEditor,
    pendingTrashId,
    setPendingTrashId,
    confirmBulkOpen,
    setConfirmBulkOpen,
    filtered,
    allVisibleSelected,
    someVisibleSelected,
    paymentModeConfig,
    getContact,
    getRep,
    getMujtahid,
    getObligationType,
    confirmRowTrash,
    confirmBulkTrash,
  };
}
