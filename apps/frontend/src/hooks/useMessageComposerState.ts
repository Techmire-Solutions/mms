import { useState, useCallback } from "react";
import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import { MESSAGING_MODULE_MANIFEST, validateRecipientAddress } from "@mms/shared";
import { dedupeRecipientsById } from "@/components/messageComposer/messageComposerRecipientsUtils";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";

export interface MessagingTarget {
  channel: "sms" | "whatsapp" | "email";
  recipients: MessagingRecipient[];
  initialMessage?: string;
  initialSubject?: string;
  templateId?: string;
}

type Channel = "sms" | "whatsapp" | "email";

interface OpenComposerOptions {
  initialMessage?: string;
  initialSubject?: string;
  templateId?: string;
}

export interface UseMessageComposerStateResult {
  messagingTarget: MessagingTarget | null;
  setMessagingTarget: React.Dispatch<React.SetStateAction<MessagingTarget | null>>;
  openComposer: (
    channel: Channel,
    recipients?: MessagingRecipient[],
    options?: OpenComposerOptions,
  ) => void;
  closeComposer: () => void;
  canWriteMessaging: boolean;
}

/**
 * Custom hook to manage the state of the MessageComposer dialog.
 * Gates on messaging.write and drops recipients without a valid channel address.
 */
export function useMessageComposerState(): UseMessageComposerStateResult {
  const [messagingTarget, setMessagingTarget] = useState<MessagingTarget | null>(null);
  const { canWrite: canWriteMessaging } = useModulePermissions(MESSAGING_MODULE_MANIFEST);
  const { t } = useTranslation();

  const openComposer = useCallback(
    (channel: Channel, recipients: MessagingRecipient[] = [], options?: OpenComposerOptions) => {
      if (!canWriteMessaging) {
        notify.error(t("messaging.writeDenied"));
        return;
      }

      if (recipients.length > 0) {
        const deduped = dedupeRecipientsById(recipients);
        const eligible = deduped.filter(
          (recipient) => validateRecipientAddress(recipient, channel).isValid,
        );

        if (eligible.length === 0) {
          notify.error(t("messaging.noEligibleRecipients"));
          return;
        }

        const skipped = deduped.length - eligible.length;
        if (skipped > 0) {
          notify.warning(t("messaging.someRecipientsSkipped"));
        }

        setMessagingTarget({
          channel,
          recipients: eligible,
          initialMessage: options?.initialMessage,
          initialSubject: options?.initialSubject,
          templateId: options?.templateId,
        });
      } else {
        setMessagingTarget({
          channel,
          recipients: [],
          initialMessage: options?.initialMessage,
          initialSubject: options?.initialSubject,
          templateId: options?.templateId,
        });
      }
    },
    [canWriteMessaging, t],
  );

  const closeComposer = useCallback(() => {
    setMessagingTarget(null);
  }, []);

  return (() => ({
    messagingTarget,
    setMessagingTarget,
    openComposer,
    closeComposer,
    canWriteMessaging,
  }))();
}
