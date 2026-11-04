import { useMemo } from "react";
import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import {
  validateMessagingRecipients,
  type ValidatedMessagingRecipient,
} from "./messageComposerDispatchService";

/**
 * Recipient validation for the composer.
 *
 * The composer re-renders on every keystroke and can hold up to 50 recipients;
 * validating on each render was measurable work. Tied to the inputs instead.
 */
export function useComposerRecipientValidation(
  recipients: MessagingRecipient[],
  channel: "sms" | "whatsapp" | "email",
): {
  validatedRecipients: ValidatedMessagingRecipient[];
  eligibleRecipients: ValidatedMessagingRecipient[];
  skippedRecipients: ValidatedMessagingRecipient[];
} {
  const validatedRecipients = useMemo(
    () => validateMessagingRecipients(recipients, channel),
    [recipients, channel],
  );
  const eligibleRecipients = useMemo(
    () => validatedRecipients.filter((recipient) => recipient.isValid),
    [validatedRecipients],
  );
  const skippedRecipients = useMemo(
    () => validatedRecipients.filter((recipient) => !recipient.isValid),
    [validatedRecipients],
  );
  return { validatedRecipients, eligibleRecipients, skippedRecipients };
}
