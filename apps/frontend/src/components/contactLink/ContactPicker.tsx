import React from "react";
import { CONTACTS_MODULE_MANIFEST, type Contact } from "@mms/shared";
import { type ContactCreateDefaults } from "./ContactCreateModal";
import { ContactPickerSearchInput } from "./ContactPickerSearchInput";
import { ContactPickerSelected } from "./ContactPickerSelected";
import { useContactPickerState } from "./useContactPickerState";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";

export type { ContactCreateDefaults };

export interface ContactPickerProps {
  label: string;
  value: string | number | null;
  onChange: (id: string | number | null, contact?: Contact | null) => void;
  /** Client-side list; omit to use server search (globle2 §10). */
  contacts?: Contact[];
  excludeIds?: (string | number | null)[];
  filterGender?: string;
  hasPhone?: boolean;
  /** Show create-contact control on the search input. Default true. */
  allowCreate?: boolean;
  /** Prefill / lock fields when opening the shared contact form (e.g. father = male). */
  createDefaults?: ContactCreateDefaults;
  onAvatarChange?: (avatarUrl: string) => void;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyHint?: string;
  createLabel?: string;
  createWithQueryLabel?: (query: string) => string;
  error?: boolean;
  errorMessage?: string;
  required?: boolean;
  id?: string;
  name?: string;
}

export default function ContactPicker({
  label,
  value,
  onChange,
  contacts,
  excludeIds = [],
  filterGender,
  hasPhone,
  allowCreate = true,
  createDefaults,
  onAvatarChange,
  searchPlaceholder,
  emptyTitle,
  emptyHint,
  createLabel,
  createWithQueryLabel,
  error = false,
  errorMessage,
  required = false,
  id,
  name,
}: ContactPickerProps): React.JSX.Element {
  const { canWrite } = useModulePermissions(CONTACTS_MODULE_MANIFEST);
  const canCreate = allowCreate && canWrite;
  const picker = useContactPickerState({
    value,
    onChange,
    contacts,
    excludeIds,
    filterGender,
    hasPhone,
    onAvatarChange,
    id,
    name,
  });

  const resolvedEmptyTitle = emptyTitle ?? picker.t("contacts.picker.emptyTitle");
  const resolvedEmptyHint = emptyHint ?? picker.t("contacts.picker.emptyHint");
  const resolvedCreateLabel = createLabel ?? picker.t("contacts.picker.createLabel");
  const createActionLabel = picker.query.trim()
    ? (createWithQueryLabel?.(picker.query.trim()) ??
      picker.t("contacts.picker.createWithQuery", { query: picker.query.trim() }))
    : resolvedCreateLabel;

  if (picker.selected) {
    return (
      <ContactPickerSelected
        selected={picker.selected}
        label={label}
        required={required}
        value={value}
        resolvedId={picker.resolvedId}
        resolvedName={picker.resolvedName}
        avatarInputId={picker.avatarInputId}
        fileInputRef={picker.fileInputRef}
        onAvatarChange={onAvatarChange}
        onClear={() => onChange(null)}
        onFileChange={(event) => {
          void picker.handleFileChange(event);
        }}
      />
    );
  }

  return (
    <ContactPickerSearchInput
      t={picker.t}
      label={label}
      required={required}
      resolvedId={picker.resolvedId}
      resolvedName={picker.resolvedName}
      query={picker.query}
      open={picker.open}
      allowCreate={canCreate}
      error={Boolean(error || errorMessage)}
      errorMessage={errorMessage}
      searchPlaceholder={searchPlaceholder}
      createActionLabel={createActionLabel}
      menuRef={picker.menuRef}
      anchorRef={picker.anchorRef}
      menuStyle={picker.menuStyle}
      matches={picker.matches}
      isSearching={picker.isSearching}
      emptyTitle={resolvedEmptyTitle}
      emptyHint={resolvedEmptyHint}
      createOpen={picker.createOpen}
      createQuery={picker.createQuery}
      createDefaults={createDefaults}
      onQueryChange={picker.setQuery}
      onOpen={() => picker.setOpen(true)}
      onClearQuery={() => picker.setQuery("")}
      onOpenCreate={() => picker.openCreateFlow(picker.query)}
      onCloseDropdown={picker.closeDropdown}
      onSelect={(contact) => {
        picker.setSelectedCache(contact);
        onChange(contact.id, contact);
        picker.closeDropdown();
      }}
      onCloseCreate={() => picker.setCreateOpen(false)}
      onCreated={(contact) => {
        picker.setSelectedCache(contact);
        onChange(contact.id, contact);
        picker.setCreateOpen(false);
      }}
    />
  );
}
