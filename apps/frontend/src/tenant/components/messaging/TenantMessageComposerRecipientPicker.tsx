import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { StandardMessagingRecipient, Contact } from "@mms/shared";
import {
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  toMessagingRecipient,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useMessagingWorkRecipients } from "@/tenant/features/messaging/hooks/useMessagingWorkRecipients";
import { useContactColumns } from "@/lib/contexts/ContactConfigContext";
import ContactsListDesktopTable from "@/tenant/features/contacts/components/ContactsListDesktopTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/ErrorState";

export interface MessageComposerRecipientPickerProps {
  kind: "phone" | "email";
  existingIds: Set<string>;
  disabled?: boolean;
  onAdd: (recipient: StandardMessagingRecipient) => void;
  onRemove: (id: string | number) => void;
}

const DEBOUNCE_MS = 300;

export function TenantMessageComposerRecipientPicker({
  kind: _kind,
  existingIds,
  disabled,
  onAdd,
  onRemove,
}: MessageComposerRecipientPickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const columns = useContactColumns();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { contacts, total, isPending, isFetching, hasMore, isError, refetch } =
    useMessagingWorkRecipients({
      roleFilter: "all",
      genderFilter: "all",
      search: debouncedQuery,
      page,
      pageSize: 50,
    });

  const toRecipient = useCallback((contact: Contact): StandardMessagingRecipient => {
    return toMessagingRecipient(contact, {
      getPrimaryPhone,
      getPrimaryEmail,
      getDisplayName,
    });
  }, []);

  const handleToggle = useCallback(
    (contact: Contact): void => {
      const isAdded = existingIds.has(String(contact.id));
      if (isAdded) {
        onRemove(contact.id);
        return;
      }
      onAdd(toRecipient(contact));
    },
    [existingIds, onAdd, onRemove, toRecipient],
  );

  const handleSelect = (contactId: string | number) => {
    const contact = contacts.find((c) => String(c.id) === String(contactId));
    if (contact) handleToggle(contact);
  };

  const handleSelectAll = () => {
    const allSelected = contacts.length > 0 && contacts.every((c) => existingIds.has(String(c.id)));
    if (allSelected) {
      contacts.forEach((c) => onRemove(c.id));
      return;
    }
    contacts.forEach((c) => {
      if (!existingIds.has(String(c.id))) onAdd(toRecipient(c));
    });
  };

  const allSelected = contacts.length > 0 && contacts.every((c) => existingIds.has(String(c.id)));
  const someSelected =
    contacts.length > 0 && contacts.some((c) => existingIds.has(String(c.id))) && !allSelected;
  const noop = () => {};

  return (
    <div className="flex min-h-125 flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchBar
          placeholder={t("messaging.searchRecipients")}
          value={query}
          onChange={setQuery}
          className="flex-1"
        />
        {(isPending || isFetching) && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      <div
        className="relative flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background"
        aria-busy={isPending || isFetching || undefined}
      >
        {isError ? (
          <div className="flex flex-1 items-center justify-center p-4">
            <ErrorState
              compact
              title={t("messaging.loadFailed")}
              description={t("messaging.loadFailedHint")}
              onRetry={refetch}
            />
          </div>
        ) : contacts.length === 0 && !isPending && !isFetching ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {t("messaging.noRecipientsFound")}
          </div>
        ) : (
          <ContactsListDesktopTable
            contacts={contacts}
            selected={Array.from(existingIds)}
            onSelect={disabled ? noop : handleSelect}
            onSelectAll={disabled ? noop : handleSelectAll}
            onView={noop}
            onEdit={noop}
            onDelete={noop}
            sortField="name"
            sortDir="asc"
            onSort={noop}
            columns={columns}
            allContacts={contacts}
            allSelected={allSelected}
            someSelected={someSelected}
          />
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-muted-foreground">
          {t("messaging.pagination.showingRecords", {
            count: contacts.length,
            total: total || contacts.length,
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={page === 1 || isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("common.previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("messaging.pagination.page", { page })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={!hasMore || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
