import React, { useMemo } from "react";
import type { StandardMessagingRecipient } from "@mms/shared";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { CompactSegmentedControl } from "@/components/ui/CompactSegmentedControl";
import { useTranslation } from "@/hooks/useTranslation";
import { MessageComposerRecipientsList } from "./MessageComposerRecipientsList";
import type { ValidatedMessagingRecipient } from "./useMessageComposerDispatch";

export type RecipientTab = "all" | "eligible" | "skipped";

export interface RecipientPickerSlotProps {
  kind: "phone" | "email";
  existingIds: Set<string>;
  disabled?: boolean;
  onAdd: (recipient: StandardMessagingRecipient) => void;
  onRemove: (id: string | number) => void;
}

const MIN_RECIPIENTS_FOR_SEARCH = 3;

export interface MessageComposerRecipientsProps {
  isEmail: boolean;
  isSms: boolean;
  recipientTab: RecipientTab;
  search: string;
  displayedRecipients: ValidatedMessagingRecipient[];
  validatedRecipients: ValidatedMessagingRecipient[];
  eligibleRecipients: ValidatedMessagingRecipient[];
  skippedRecipients: ValidatedMessagingRecipient[];
  previewIndex: number;
  message: string;
  disabled?: boolean;
  onRecipientTabChange: (tab: RecipientTab) => void;
  onSearchChange: (search: string) => void;
  onPreviewIndexChange: (index: number) => void;
  onSendOne: (recipient: ValidatedMessagingRecipient, message: string) => void;
  onAdd: (recipient: StandardMessagingRecipient) => void;
  onRemove: (id: string | number) => void;
  isPickStep: boolean;
  renderRecipientPicker?: (props: RecipientPickerSlotProps) => React.ReactNode;
}

export function MessageComposerRecipients({
  isEmail,
  isSms,
  recipientTab,
  search,
  displayedRecipients,
  validatedRecipients,
  eligibleRecipients,
  skippedRecipients,
  previewIndex,
  message,
  disabled,
  onRecipientTabChange,
  onSearchChange,
  onPreviewIndexChange,
  onSendOne,
  onAdd,
  onRemove,
  isPickStep,
  renderRecipientPicker,
}: MessageComposerRecipientsProps): React.JSX.Element {
  const { t } = useTranslation();

  const existingIds = useMemo(
    () => new Set(validatedRecipients.map((r) => String(r.id))),
    [validatedRecipients],
  );
  const eligibleIndexMap = useMemo(
    () => new Map(eligibleRecipients.map((r, i) => [r.id, i])),
    [eligibleRecipients],
  );

  const missingAddressLabel = isEmail ? t("messaging.missingEmail") : t("messaging.missingPhone");
  const removeLabel = t("messaging.removeRecipient");
  const totalCount = validatedRecipients.length;

  const noEligibleMessage = isEmail
    ? t("messaging.selectRecipientsDesc")
    : isSms
      ? t("messaging.smsNoEligibleContacts")
      : t("messaging.whatsappSkippedNote");

  return (
    <>
      <div className="space-y-2">
        {!isPickStep && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-1">
            <SectionLabel weight="bold" tracking="wider" className="block">
              {t("messaging.confirmRecipients")} ({totalCount})
            </SectionLabel>
            <CompactSegmentedControl
              options={[
                { value: "all", label: `${t("messaging.filter.all")} (${validatedRecipients.length})` },
                { value: "eligible", label: `${t("messaging.filter.eligible")} (${eligibleRecipients.length})` },
                ...(skippedRecipients.length
                  ? [{ value: "skipped", label: `${t("messaging.filter.skipped")} (${skippedRecipients.length})` }]
                  : []),
              ]}
              value={recipientTab}
              onChange={(value) => onRecipientTabChange(value as RecipientTab)}
            />
          </div>
        )}

        {renderRecipientPicker ? (
          renderRecipientPicker({
            kind: isEmail ? "email" : "phone",
            existingIds,
            disabled,
            onAdd,
            onRemove,
          })
        ) : null}

        {!isPickStep && (
          <>
            {totalCount > MIN_RECIPIENTS_FOR_SEARCH && (
              <SearchBar
                placeholder={t("messaging.search.placeholder")}
                value={search}
                onChange={onSearchChange}
                className="text-xs"
              />
            )}

            <MessageComposerRecipientsList
              displayedRecipients={displayedRecipients}
              eligibleIndexMap={eligibleIndexMap}
              previewIndex={previewIndex}
              message={message}
              isEmail={isEmail}
              isSms={isSms}
              disabled={disabled}
              onPreviewIndexChange={onPreviewIndexChange}
              onSendOne={onSendOne}
              onRemove={onRemove}
              missingAddressLabel={missingAddressLabel}
              removeLabel={removeLabel}
            />
          </>
        )}
      </div>

      {!isPickStep && eligibleRecipients.length === 0 && (
        <p className="text-xs font-medium text-destructive">{noEligibleMessage}</p>
      )}
    </>
  );
}
