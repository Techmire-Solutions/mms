import React from "react";
import { Search, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORM_LABEL, FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { FieldErrorMessage, RequiredMark } from "@/components/ui/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactPickerMenu } from "./ContactPickerMenu";
import ContactCreateModal from "./ContactCreateModal";
import type { ContactCreateDefaults } from "./ContactCreateModal";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { Contact } from "@mms/shared";

interface ContactPickerSearchInputProps {
  t: TranslationFunction;
  label: string;
  required?: boolean;
  resolvedId: string;
  resolvedName: string;
  query: string;
  open: boolean;
  allowCreate: boolean;
  error: boolean;
  errorMessage?: string;
  searchPlaceholder?: string;
  createActionLabel: string;
  menuRef: React.RefObject<HTMLDivElement>;
  anchorRef: React.RefObject<HTMLDivElement>;
  menuStyle: React.CSSProperties;
  matches: Contact[];
  isSearching: boolean;
  emptyTitle: string;
  emptyHint: string;
  createOpen: boolean;
  createQuery: string;
  createDefaults?: ContactCreateDefaults;
  onQueryChange: (value: string) => void;
  onOpen: () => void;
  onClearQuery: () => void;
  onOpenCreate: () => void;
  onCloseDropdown: () => void;
  onSelect: (contact: Contact) => void;
  onCloseCreate: () => void;
  onCreated: (contact: Contact) => void;
}

export function ContactPickerSearchInput({
  t,
  label,
  required = false,
  resolvedId,
  resolvedName,
  query,
  open,
  allowCreate,
  error,
  errorMessage,
  searchPlaceholder,
  createActionLabel,
  menuRef,
  anchorRef,
  menuStyle,
  matches,
  isSearching,
  emptyTitle,
  emptyHint,
  createOpen,
  createQuery,
  createDefaults,
  onQueryChange,
  onOpen,
  onClearQuery,
  onOpenCreate,
  onCloseDropdown,
  onSelect,
  onCloseCreate,
  onCreated,
}: ContactPickerSearchInputProps): React.JSX.Element {
  const errorId = errorMessage ? `${resolvedId}-error` : undefined;
  const isInvalid = Boolean(error || errorMessage);

  return (
    <div className="relative">
      <label htmlFor={resolvedId} className={FORM_LABEL}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <div ref={anchorRef} className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/75 pointer-events-none" />
        <Input
          id={resolvedId}
          name={resolvedName}
          className={cn(
            "ps-9.5",
            allowCreate ? (query ? "pe-16" : "pe-10") : query ? "pe-9" : "pe-3",
            isInvalid && FORM_INPUT_ERROR,
          )}
          placeholder={searchPlaceholder ?? t("contacts.searchPlaceholder")}
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            onOpen();
          }}
          onFocus={onOpen}
          autoComplete="off"
          aria-expanded={open}
          aria-controls={open ? `${resolvedId}-listbox` : undefined}
          aria-invalid={isInvalid}
          aria-describedby={errorId}
          aria-autocomplete="list"
          role="combobox"
        />
        <div className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClearQuery}
              aria-label={t("common.clearSearch")}
              className="text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted shadow-none"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          ) : null}
          {allowCreate ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onMouseDown={(event) => {
                event.preventDefault();
                onOpenCreate();
                onCloseDropdown();
              }}
              title={createActionLabel}
              aria-label={createActionLabel}
              className="text-primary hover:text-primary hover:bg-primary/10 transition-colors rounded-md shadow-none"
            >
              <Plus className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <FieldErrorMessage id={errorId} message={errorMessage} className="mt-1.5" />
      ) : null}

      <ContactPickerMenu
        open={open}
        menuRef={menuRef}
        resolvedId={resolvedId}
        label={label}
        menuStyle={menuStyle}
        matches={matches}
        isSearching={isSearching}
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
        onSelect={onSelect}
      />

      {allowCreate ? (
        <ContactCreateModal
          open={createOpen}
          onClose={onCloseCreate}
          initialName={createQuery}
          createDefaults={createDefaults}
          onCreated={onCreated}
        />
      ) : null}
    </div>
  );
}
