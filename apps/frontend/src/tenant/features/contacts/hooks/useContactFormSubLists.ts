import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { ensureSinglePrimaryFlag, type Contact } from "@mms/shared";
import { useIdentityReset } from "@/lib/forms/useIdentityReset";
import type {
  AddSubListItem,
  ContactSubListKey,
  EnsureSubListItem,
  RemoveSubListItem,
  SetPrimarySubListItem,
  UpdateSubListItem,
} from "@/tenant/features/contacts/components/formTabs/types";

function withHealedPrimary(fieldKey: ContactSubListKey, list: unknown[]): unknown[] {
  if (fieldKey !== "phones" && fieldKey !== "emails" && fieldKey !== "addresses") {
    return list;
  }
  return ensureSinglePrimaryFlag(list as Array<{ isPrimary?: boolean }>);
}

function newLocalId(formInstanceId: string, fieldKey: string): string {
  const suffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${formInstanceId}-${fieldKey}-${suffix}`;
}

/** Stamp a stable `id` and `_localId` on a sub-list item if it doesn't already have one. */
function withLocalId<T>(item: T): T {
  if (item && typeof item === "object") {
    const rec = item as Record<string, unknown>;
    const id =
      (typeof rec.id === "string" && rec.id) ||
      (typeof rec._localId === "string" && rec._localId) ||
      crypto.randomUUID();
    return { ...item, id, _localId: id };
  }
  return item;
}

export function useContactFormSubLists(
  contactDraft: Partial<Contact>,
  setContactDraft: Dispatch<SetStateAction<Partial<Contact>>>,
  formInstanceId: string,
) {
  // Stable row ids per sub-list tab. Keys must not derive from the array index:
  // removing row 0 used to shift every remaining row's key/DOM node.
  const localIdsRef = useRef<Record<string, string[]>>({});
  useIdentityReset(formInstanceId, () => {
    localIdsRef.current = {};
  });

  const idsFor = useCallback(
    (fieldKey: string, length: number): string[] => {
      const ids = localIdsRef.current[fieldKey] ?? [];
      while (ids.length < length) ids.push(newLocalId(formInstanceId, fieldKey));
      if (ids.length > length) ids.length = length;
      localIdsRef.current[fieldKey] = ids;
      return ids;
    },
    [formInstanceId],
  );

  const getLocalId = useCallback(
    (fieldKey: string, idx: number): string => {
      const ids = idsFor(fieldKey, idx + 1);
      return ids[idx] ?? `${formInstanceId}-${fieldKey}-${idx}`;
    },
    [formInstanceId, idsFor],
  );

  const addSubListItem: AddSubListItem = useCallback(
    (fieldKey, newItem) => {
      const currentLength = (contactDraft as Record<string, unknown>)[fieldKey];
      const nextLength = Array.isArray(currentLength) ? currentLength.length + 1 : 1;
      // Ledger mutation happens outside the state updater so a StrictMode double
      // invocation cannot register the same row twice.
      idsFor(fieldKey, nextLength);
      setContactDraft((prev) => {
        const rawList = (prev as Record<string, unknown>)[fieldKey];
        const currentList = Array.isArray(rawList) ? rawList : [];
        return {
          ...prev,
          [fieldKey]: withHealedPrimary(fieldKey, [...currentList, withLocalId(newItem)]),
        };
      });
    },
    [contactDraft, idsFor, setContactDraft],
  );

  /** Seed one row when the list is empty (idempotent under Strict Mode). */
  const ensureSubListItem: EnsureSubListItem = useCallback(
    (fieldKey, newItem) => {
      const existing = (contactDraft as Record<string, unknown>)[fieldKey];
      if (Array.isArray(existing) && existing.length > 0) return;
      idsFor(fieldKey, 1);
      setContactDraft((prev) => {
        const rawList = (prev as Record<string, unknown>)[fieldKey];
        const currentList = Array.isArray(rawList) ? rawList : [];
        if (currentList.length > 0) return prev;
        return { ...prev, [fieldKey]: withHealedPrimary(fieldKey, [withLocalId(newItem)]) };
      });
    },
    [contactDraft, idsFor, setContactDraft],
  );

  const updateSubListItem: UpdateSubListItem = useCallback(
    (fieldKey, idx, patch) => {
      setContactDraft((prev) => {
        const rawList = (prev as Record<string, unknown>)[fieldKey];
        const currentList = Array.isArray(rawList) ? (rawList as Record<string, unknown>[]) : [];
        const nextList = currentList.map((item, i) => {
          if (i !== idx) return item;
          if (fieldKey === "phones" && "number" in patch) {
            const prevNumber = typeof item.number === "string" ? item.number : "";
            const prevDigits = prevNumber.replace(/\D/g, "");
            const nextDigits = String(patch.number ?? "").replace(/\D/g, "");
            // Only clear the WhatsApp status when the number actually changed;
            // editing a label or a no-op reformat must not drop it.
            if (prevDigits === nextDigits) {
              return { ...item, ...patch };
            }
            const { whatsappStatus: _cleared, ...rest } = item;
            void _cleared;
            return { ...rest, ...patch };
          }
          return { ...item, ...patch };
        });
        return { ...prev, [fieldKey]: withHealedPrimary(fieldKey, nextList) };
      });
    },
    [setContactDraft],
  );

  const removeSubListItem: RemoveSubListItem = useCallback(
    (fieldKey: ContactSubListKey, idx: number) => {
      const current = (contactDraft as Record<string, unknown>)[fieldKey];
      if (Array.isArray(current)) {
        const ids = idsFor(fieldKey, current.length);
        ids.splice(idx, 1);
      }
      setContactDraft((prev) => {
        const rawList = (prev as Record<string, unknown>)[fieldKey];
        const currentList = Array.isArray(rawList) ? rawList : [];
        return {
          ...prev,
          [fieldKey]: withHealedPrimary(
            fieldKey,
            currentList.filter((_, i) => i !== idx),
          ),
        };
      });
    },
    [contactDraft, idsFor, setContactDraft],
  );

  const setPrimarySubListItem: SetPrimarySubListItem = useCallback(
    (fieldKey: ContactSubListKey, idx: number) => {
      setContactDraft((prev) => {
        const rawList = (prev as Record<string, unknown>)[fieldKey];
        const currentList = Array.isArray(rawList) ? (rawList as Record<string, unknown>[]) : [];
        const nextList = currentList.map((item, i) => ({
          ...item,
          isPrimary: i === idx,
        }));
        return { ...prev, [fieldKey]: nextList };
      });
    },
    [setContactDraft],
  );

  return {
    getLocalId,
    addSubListItem,
    ensureSubListItem,
    updateSubListItem,
    removeSubListItem,
    setPrimarySubListItem,
  };
}
