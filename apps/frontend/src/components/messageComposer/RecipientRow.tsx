import React, { memo } from "react";
import { X } from "lucide-react";
import { getInitials } from "@mms/shared";
import { Button } from "@/components/ui/button";
import type { ValidatedMessagingRecipient } from "./useMessageComposerDispatch";

export interface RecipientRowProps {
  recipient: ValidatedMessagingRecipient;
  eligibleIndex: number;
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
  sendLabel: string;
}

export const RecipientRow = memo(function RecipientRow({
  recipient,
  eligibleIndex,
  previewIndex,
  message,
  isEmail,
  isSms: _isSms,
  disabled,
  onPreviewIndexChange,
  onSendOne,
  onRemove,
  missingAddressLabel,
  removeLabel,
  sendLabel,
}: RecipientRowProps): React.JSX.Element {
  const displayAddress =
    recipient.address || (isEmail ? recipient.email : recipient.phone) || missingAddressLabel;

  const isPreviewActive = recipient.isValid && previewIndex === eligibleIndex;
  const previewDisabled = eligibleIndex < 0;

  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded p-1.5 text-xs transition-colors ${
        !recipient.isValid
          ? "border border-warning/20 bg-warning/10 text-warning"
          : isPreviewActive
            ? "bg-primary/10 font-semibold text-foreground"
            : "text-muted-foreground hover:bg-muted/30"
      }`}
      role="listitem"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-extrabold text-primary">
        {getInitials(recipient.name)}
      </span>
      <div className="min-w-0 flex-1">
        <Button
          type="button"
          variant="ghost"
          disabled={previewDisabled}
          className="h-auto min-h-11 w-full min-w-0 justify-start truncate px-2 text-xs"
          onClick={() => onPreviewIndexChange(eligibleIndex)}
        >
          {recipient.name}
        </Button>
        <span className="block truncate px-2 font-mono text-xs text-muted-foreground">
          ({displayAddress})
        </span>
      </div>

      <div className="ms-auto flex shrink-0 items-center gap-1">
        {recipient.isValid ? (
          <Button
            type="button"
            variant="link"
            className="inline-flex min-h-11 items-center p-0 text-xs font-semibold text-primary"
            onClick={() => onSendOne(recipient, message)}
          >
            {sendLabel}
          </Button>
        ) : (
          <span className="text-xs font-semibold text-warning">{sendLabel}</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => onRemove(recipient.id)}
          className="relative min-h-11 min-w-11 text-muted-foreground hover:text-destructive"
          aria-label={removeLabel}
          title={removeLabel}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
});
