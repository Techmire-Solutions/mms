import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  MESSAGING_MODULE_MANIFEST,
  MESSAGING_RECIPIENTS_MATCH_LIMIT,
  messagingRecipientsMatchResponseSchema,
  type MessagingGenderFilter,
  type MessagingRoleFilter,
  type StandardMessagingRecipient,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useMessagingWorkRecipients } from "@/tenant/features/messaging/hooks/useMessagingWorkRecipients";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { ApiError } from "@mms/fe-core/api/client";
import { notify } from "@mms/fe-core/notify";
import { SearchBar } from "@mms/fe-core/components/SearchBar";
import { ListPagination } from "@mms/fe-core/components/ListPagination";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { TenantMessageComposerRecipientTable } from "./TenantMessageComposerRecipientTable";

export interface MessageComposerRecipientPickerProps {
  kind: "phone" | "email";
  existingIds: Set<string>;
  disabled?: boolean;
  onAdd: (recipient: StandardMessagingRecipient) => void;
  onRemove: (id: string | number) => void;
  /** Batch variants used by select-all (one toast instead of one per row). */
  onAddMany?: (recipients: StandardMessagingRecipient[]) => void;
  onRemoveMany?: (ids: (string | number)[]) => void;
}

const DEBOUNCE_MS = 300;

/** The picker lists the reachable directory unfiltered; keep match queries aligned. */
const ROLE_FILTER: MessagingRoleFilter = "all";
const GENDER_FILTER: MessagingGenderFilter = "all";

export function TenantMessageComposerRecipientPicker({
  kind,
  existingIds,
  disabled,
  onAdd,
  onRemove,
  onAddMany,
  onRemoveMany,
}: MessageComposerRecipientPickerProps): React.JSX.Element {
  const { t } = useTranslation();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [matching, setMatching] = useState(false);
  // State re-renders too late to stop a same-frame double click; the ref is the guard.
  const matchingRef = useRef(false);
  const [matchError, setMatchError] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const { recipients, total, isPending, isFetching, isError, refetch } = useMessagingWorkRecipients(
    {
      roleFilter: ROLE_FILTER,
      genderFilter: GENDER_FILTER,
      search: debouncedQuery,
      kind,
      page,
      pageSize: MESSAGING_MODULE_MANIFEST.defaultPageSize,
    },
  );

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

  const allSelected =
    recipients.length > 0 && recipients.every((r) => existingIds.has(String(r.id)));
  const someSelected =
    recipients.length > 0 && recipients.some((r) => existingIds.has(String(r.id))) && !allSelected;

  const handleToggleAll = async (): Promise<void> => {
    const remove = onRemoveMany ?? ((ids: (string | number)[]) => ids.forEach(onRemove));
    const add = onAddMany ?? ((list: StandardMessagingRecipient[]) => list.forEach(onAdd));
    if (allSelected) {
      remove(recipients.map((r) => r.id));
      return;
    }
    if (matchingRef.current) return;
    matchingRef.current = true;
    setMatching(true);
    setMatchError(false);
    try {
      const search = debouncedQuery.trim();
      const response = await apiContract.messaging.matchRecipients({
        query: {
          role: ROLE_FILTER,
          gender: GENDER_FILTER,
          ...(search ? { search } : {}),
          kind,
        },
      });
      if (response.status !== 200) {
        const errorBody = response.body as { message?: string; type?: string } | undefined;
        throw new ApiError(
          response.status,
          errorBody?.message ?? "Failed to match messaging recipients",
          errorBody?.type,
        );
      }
      const body = messagingRecipientsMatchResponseSchema.parse(response.body);
      const seen = new Set(existingIds);
      const matched = body.recipients.filter((recipient) => {
        const id = String(recipient.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      const capped = matched.slice(0, MESSAGING_RECIPIENTS_MATCH_LIMIT);
      if (capped.length > 0) add(capped);
      if (body.truncated) {
        notify.info(t("messaging.selectAllTruncated"));
      }
    } catch {
      setMatchError(true);
      notify.error(t("messaging.selectAllFailed"));
    } finally {
      matchingRef.current = false;
      setMatching(false);
    }
  };

  return (
    <div className="flex min-h-125 flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchBar
          placeholder={t("messaging.searchRecipients")}
          value={query}
          onChange={setQuery}
          className="flex-1"
        />
        {(isPending || isFetching || matching) && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      {matchError ? (
        <p role="alert" className="text-xs text-destructive">
          {t("messaging.selectAllFailed")}
        </p>
      ) : null}

      <div
        className="relative flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background"
        aria-busy={isPending || isFetching || matching || undefined}
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
        ) : recipients.length === 0 && !isPending && !isFetching ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {t("messaging.noRecipientsFound")}
          </div>
        ) : (
          <TenantMessageComposerRecipientTable
            recipients={recipients}
            selectedIds={existingIds}
            disabled={disabled || matching}
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
          total={total || recipients.length}
          limit={MESSAGING_MODULE_MANIFEST.defaultPageSize}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
