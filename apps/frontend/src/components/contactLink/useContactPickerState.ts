import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
  type ChangeEvent,
  type RefObject,
  useMemo,
} from "react";
import {
  type Contact,
  type ContactPickerOption,
  type ContactPickerSearchQuery,
  filterContactsForQuery,
} from "@mms/shared";
import { uploadUserImage } from "@/lib/imageUpload";
import type { ContactCreateDefaults } from "./ContactCreateModal";
import { useDebounce } from "@/hooks/useDebounce";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useContactPickerOption,
  useContactPickerSearch,
} from "@/tenant/hooks/collections/contacts";
import { notify } from "@/lib/notify";
import { reportClientError } from "@/lib/clientErrorReporting";
import { useAnchorMenuStyle } from "./useAnchorMenuStyle";

const PICKER_PAGE_SIZE = 8;
/** Mirrors the backend picker cap so the query string stays inside the contract. */
const PICKER_MAX_EXCLUDE_IDS = 100;

/** Lean picker option → the minimal Contact the picker's match/selected views read. */
function toPickerContact(option: ContactPickerOption): Contact {
  return {
    id: option.id,
    name: option.name,
    firstName: option.name.split(" ")[0] ?? option.name,
    ...(option.email ? { email: option.email } : {}),
    ...(option.phone ? { phone: option.phone } : {}),
    addresses: option.city ? [{ city: option.city }] : [],
  };
}

export interface UseContactPickerStateOptions {
  value: string | number | null;
  onChange: (id: string | number | null, contact?: Contact | null) => void;
  contacts?: Contact[];
  excludeIds?: (string | number | null)[];
  filterGender?: string;
  hasPhone?: boolean;
  onAvatarChange?: (avatarUrl: string) => void;
  id?: string;
  name?: string;
}

export function useContactPickerState({
  value,
  onChange,
  contacts,
  excludeIds = [],
  filterGender,
  hasPhone,
  onAvatarChange,
  id,
  name,
}: UseContactPickerStateOptions) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createQuery, setCreateQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const serverMode = contacts === undefined;
  const fallbackId = useId();
  const resolvedId = id || fallbackId;
  const resolvedName = name || fallbackId;
  const avatarInputId = `${resolvedId}-avatar`;
  const menuStyle = useAnchorMenuStyle(open, anchorRef);

  const normalizedExcludeIds = useMemo(
    () =>
      excludeIds
        .filter(
          (excludeId): excludeId is string | number =>
            excludeId != null && String(excludeId).length > 0,
        )
        .map(String),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on excludeIds.join(",") to keep identity stable; depending on excludeIds would recompute (and refetch) on every new array literal.
    [excludeIds.join(",")],
  );

  const debouncedQuery = useDebounce(query, 250);
  const pickerSearchQuery = useMemo<ContactPickerSearchQuery>(
    () => ({
      search: debouncedQuery,
      limit: PICKER_PAGE_SIZE,
      ...(filterGender ? { gender: filterGender } : {}),
      ...(hasPhone ? { hasPhone } : {}),
      ...(normalizedExcludeIds.length > 0
        ? { excludeIds: normalizedExcludeIds.slice(0, PICKER_MAX_EXCLUDE_IDS).join(",") }
        : {}),
    }),
    [debouncedQuery, filterGender, hasPhone, normalizedExcludeIds],
  );
  const { data: searchPage, isFetching: isSearching } = useContactPickerSearch(
    pickerSearchQuery,
    serverMode && open,
  );
  const { data: resolvedOption } = useContactPickerOption(
    value != null ? String(value) : undefined,
    serverMode && value != null,
  );

  const selectedFromServer = (() => {
    const option = resolvedOption?.body?.contact as ContactPickerOption | null | undefined;
    return option ? toPickerContact(option) : null;
  })();

  const directory = (() => {
    if (!serverMode) return contacts ?? [];
    const options = (searchPage?.body?.contacts ?? []) as ContactPickerOption[];
    return options.map(toPickerContact);
  })();

  const closeDropdown = useCallback(() => {
    setQuery("");
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeDropdown();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeDropdown();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeDropdown]);

  const [selectedCache, setSelectedCache] = useState<Contact | null>(null);

  const matches = (() =>
    filterContactsForQuery(directory, {
      search: query,
      gender: filterGender,
      hasPhone,
      excludeIds: normalizedExcludeIds,
    }).slice(0, PICKER_PAGE_SIZE))();

  const selected = (() => {
    if (value == null) return null;
    const valStr = String(value);
    const matchById = (contact: Contact) => String(contact.id) === valStr;
    if (selectedCache && String(selectedCache.id) === valStr) {
      return selectedFromServer ?? selectedCache;
    }
    return (
      (serverMode ? selectedFromServer : contacts?.find(matchById)) ??
      directory.find(matchById) ??
      null
    );
  })();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadUserImage(file, "avatar");
      onAvatarChange?.(url);
    } catch (err) {
      notify.error(t("account.photoUploadFailed"));
      reportClientError(err, { scope: "ContactPicker.avatar_upload" });
    }
    event.target.value = "";
  };

  const openCreateFlow = (searchText: string): void => {
    setCreateQuery(searchText);
    setCreateOpen(true);
  };

  return {
    t,
    query,
    setQuery,
    open,
    setOpen,
    createOpen,
    setCreateOpen,
    createQuery,
    fileInputRef: fileInputRef as RefObject<HTMLInputElement>,
    anchorRef: anchorRef as RefObject<HTMLDivElement>,
    menuRef: menuRef as RefObject<HTMLDivElement>,
    resolvedId,
    resolvedName,
    avatarInputId,
    menuStyle,
    matches,
    isSearching,
    selected,
    closeDropdown,
    handleFileChange,
    openCreateFlow,
    setSelectedCache,
    onChange,
    onAvatarChange,
  };
}

export type { ContactCreateDefaults };
