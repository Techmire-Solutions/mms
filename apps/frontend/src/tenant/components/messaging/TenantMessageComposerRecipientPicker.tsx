import { useCallback, useEffect, useMemo, useState } from "react";
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
import { SearchBar } from "@/components/app/SearchBar";
import { ListPagination } from "@/components/app/ListPagination";
import { ErrorState } from "@/components/app/ErrorState";
import { TenantMessageComposerRecipientTable } from "./TenantMessageComposerRecipientTable";

export interface MessageComposerRecipientPickerProps {
  kind: "phone" | "email";
  existingIds: Set<string>;
  disabled?: boolean;
  onAdd: (recipient: StandardMessagingRecipient) => void;
  onRemove: (id: string | number) => void;
}

const DEBOUNCE_MS = 300;

export function TenantMessageComposerRecipientPicker({
  kind,
  existingIds,
  disabled,
  onAdd,
  onRemove,
}: MessageComposerRecipientPickerProps): React.JSX.Element {
  const { t } = useTranslation();

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

  const { contacts, total, isPending, isFetching, isError, refetch } = useMessagingWorkRecipients({
    roleFilter: "all",
    genderFilter: "all",
    search: debouncedQuery,
    kind,
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

  const recipients = useMemo(() => contacts.map(toRecipient), [contacts, toRecipient]);

  const handleToggle = useCallback(
    (recipient: StandardMessagingRecipient): void => {
      const isAdded = existingIds.has(String(recipient.id));
      if (isAdded) {
        onRemove(recipient.id);
        return;
      }
      onAdd(recipient);
    },
    [existingIds, onAdd, onRemove],
  );

  const handleToggleAll = () => {
    const allSelected =
      recipients.length > 0 && recipients.every((r) => existingIds.has(String(r.id)));
    if (allSelected) {
      recipients.forEach((r) => onRemove(r.id));
      return;
    }
    recipients.forEach((r) => {
      if (!existingIds.has(String(r.id))) onAdd(r);
    });
  };

  const allSelected =
    recipients.length > 0 && recipients.every((r) => existingIds.has(String(r.id)));
  const someSelected =
    recipients.length > 0 && recipients.some((r) => existingIds.has(String(r.id))) && !allSelected;

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
          <TenantMessageComposerRecipientTable
            recipients={recipients}
            selectedIds={existingIds}
            disabled={disabled}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
            allSelected={allSelected}
            someSelected={someSelected}
          />
        )}
      </div>

      <div className="pt-1">
        <ListPagination
          page={page}
          total={total || contacts.length}
          limit={50}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
