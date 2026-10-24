import { useCallback, type Dispatch, type SetStateAction } from "react";
import { ensureSinglePrimaryFlag, type Contact } from "@mms/shared";
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

export function useContactFormSubLists(
  setContactDraft: Dispatch<SetStateAction<Partial<Contact>>>,
) {
  const addSubListItem: AddSubListItem = useCallback(
    (fieldKey, newItem) => {
      setContactDraft((prev) => {
        const rawList = (prev as Record<string, unknown>)[fieldKey];
        const currentList = Array.isArray(rawList) ? rawList : [];
        return {
          ...prev,
          [fieldKey]: withHealedPrimary(fieldKey, [...currentList, newItem]),
        };
      });
    },
    [setContactDraft],
  );

  /** Seed one row when the list is empty (idempotent under Strict Mode). */
  const ensureSubListItem: EnsureSubListItem = useCallback(
    (fieldKey, newItem) => {
      setContactDraft((prev) => {
        const rawList = (prev as Record<string, unknown>)[fieldKey];
        const currentList = Array.isArray(rawList) ? rawList : [];
        if (currentList.length > 0) return prev;
        return { ...prev, [fieldKey]: withHealedPrimary(fieldKey, [newItem]) };
      });
    },
    [setContactDraft],
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
    [setContactDraft],
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
    addSubListItem,
    ensureSubListItem,
    updateSubListItem,
    removeSubListItem,
    setPrimarySubListItem,
  };
}
