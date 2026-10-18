import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EmptyState } from "@/components/app/EmptyState";
import { useTranslation } from "@/hooks/useTranslation";
import { RecipientRow } from "./RecipientRow";
import type { ValidatedMessagingRecipient } from "./useMessageComposerDispatch";

interface MessageComposerRecipientsListProps {
  displayedRecipients: ValidatedMessagingRecipient[];
  eligibleIndexMap: Map<string | number, number>;
  previewIndex: number;
  message: string;
  isEmail: boolean;
  isSms: boolean;
  disabled?: boolean;
  onPreviewIndexChange: (index: number) => void;
  onSendOne: (recipient: ValidatedMessagingRecipient, message: string) => void;
  onRemove: (id: string | number) => void;
  missingAddressLabel: string;
  removeLabel: string;
}

export function MessageComposerRecipientsList({
  displayedRecipients,
  eligibleIndexMap,
  previewIndex,
  message,
  isEmail,
  isSms,
  disabled,
  onPreviewIndexChange,
  onSendOne,
  onRemove,
  missingAddressLabel,
  removeLabel,
}: MessageComposerRecipientsListProps): React.JSX.Element {
  const { t } = useTranslation();
  const listParentRef = useRef<HTMLDivElement>(null);
  const isListVirtualized = displayedRecipients.length > 25;

  const rowVirtualizer = useVirtualizer({
    count: displayedRecipients.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 52,
    overscan: 4,
    enabled: isListVirtualized,
  });

  const getSendLabel = (recipient: ValidatedMessagingRecipient) => {
    if (!recipient.isValid) return t("messaging.skippedStatus");
    if (isEmail) return t("messaging.sendEmail");
    if (isSms) return t("messaging.openSmsApp");
    return t("messaging.openWhatsapp");
  };

  const rowProps = (recipient: ValidatedMessagingRecipient) => ({
    recipient,
    eligibleIndex: eligibleIndexMap.get(recipient.id) ?? -1,
    previewIndex,
    message,
    isEmail,
    isSms,
    disabled,
    onPreviewIndexChange,
    onSendOne,
    onRemove,
    missingAddressLabel,
    removeLabel,
    sendLabel: getSendLabel(recipient),
  });

  return (
    <div
      ref={listParentRef}
      className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-border/50 bg-muted/10 p-2"
      role="list"
    >
      {displayedRecipients.length === 0 ? (
        <EmptyState title={t("messaging.noRecipientsFound")} compact icon={null} />
      ) : isListVirtualized ? (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const recipient = displayedRecipients[virtualRow.index];
            return (
              <div
                key={recipient.id}
                style={{
                  position: "absolute",
                  top: 0,
                  insetInlineStart: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <RecipientRow {...rowProps(recipient)} />
              </div>
            );
          })}
        </div>
      ) : (
        displayedRecipients.map((recipient) => (
          <RecipientRow key={recipient.id} {...rowProps(recipient)} />
        ))
      )}
    </div>
  );
}
