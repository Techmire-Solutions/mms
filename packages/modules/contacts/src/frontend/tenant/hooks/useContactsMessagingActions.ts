import { useCallback } from "react";
import {
  getDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  toMessagingRecipient,
  type Contact,
} from "@mms/contracts";
import { useMessageComposerState } from "./useMessageComposerState.js";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import {
  openContactDeviceChannel,
  type ContactMessagingChannel,
} from "./contactsDeviceMessaging.js";

/**
 * Contacts messaging openers backed by the shared MessageComposer state.
 *
 * The composer needs `messaging.write` (role + Messaging module enabled). Without
 * it a single-contact WhatsApp / SMS / Email button still does something useful:
 * it opens the device app (wa.me / sms: / mailto:) — the same plain links the
 * phone and email cells already render — instead of only toasting a denial.
 */
export function useContactsMessagingActions() {
  const { messagingTarget, openComposer, closeComposer, canWriteMessaging } =
    useMessageComposerState();
  const { t } = useTranslation();

  const openChannel = useCallback(
    (channel: ContactMessagingChannel, contacts: Contact[]) => {
      if (canWriteMessaging) {
        openComposer(
          channel,
          contacts.map((c) =>
            toMessagingRecipient(c, { getDisplayName, getPrimaryPhone, getPrimaryEmail }),
          ),
        );
        return;
      }
      const [only] = contacts;
      if (contacts.length === 1 && only && openContactDeviceChannel(channel, only)) return;
      notify.error(t("messaging.writeDenied"));
    },
    [canWriteMessaging, openComposer, t],
  );

  const handleWhatsApp = useCallback(
    (contacts: Contact[]) => openChannel("whatsapp", contacts),
    [openChannel],
  );
  const handleSms = useCallback(
    (contacts: Contact[]) => openChannel("sms", contacts),
    [openChannel],
  );
  const handleEmail = useCallback(
    (contacts: Contact[]) => openChannel("email", contacts),
    [openChannel],
  );

  return {
    messagingTarget,
    closeComposer,
    canWriteMessaging,
    handleWhatsApp,
    handleSms,
    handleEmail,
  };
}
