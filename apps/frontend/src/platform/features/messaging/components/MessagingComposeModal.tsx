import React, { useState } from "react";
import { Checkbox, Input } from "@mms/ui";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformContacts } from "@/platform/features/contacts/hooks/usePlatformContacts";
import {
  PLATFORM_MESSAGING_CHANNELS,
  PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS,
  type PlatformMessagingChannel,
} from "@/platform/features/messaging/lib/platformMessagingChannels";

/** Broadcast composer (shared FormModal lifecycle). */
export function MessagingComposeModal({
  saving,
  onClose,
  onSend,
}: {
  saving: boolean;
  onClose: () => void;
  onSend: (input: {
    channel: PlatformMessagingChannel;
    subject?: string | null;
    body: string;
    contactIds: string[];
  }) => Promise<void>;
}): React.JSX.Element {
  const { t } = useTranslation();
  const { data: contacts = [] } = usePlatformContacts({ limit: 500 });
  const [channel, setChannel] = useState<PlatformMessagingChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contactIds, setContactIds] = useState<string[]>([]);

  const toggle = (id: string, checked: boolean): void => {
    setContactIds((current) => (checked ? [...current, id] : current.filter((c) => c !== id)));
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("platform.messaging.compose")}
      saveLabel={t("platform.messaging.send")}
      onSave={() => onSend({ channel, subject: subject || null, body, contactIds })}
      isDirty={true}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("settings.unsavedChanges")}
      saving={saving}
      saveDisabled={contactIds.length === 0 || !body}
      tall
    >
      <div className="space-y-4">
        <Field id="m-channel" label={t("platform.messaging.channel")}>
          <FormSelect
            id="m-channel"
            name="channel"
            value={channel}
            onChange={(value) => setChannel(value as PlatformMessagingChannel)}
            options={PLATFORM_MESSAGING_CHANNELS.map((c) => ({
              value: c,
              label: t(PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS[c]),
            }))}
          />
        </Field>
        <Field id="m-subject" label={t("platform.messaging.subject")}>
          <Input id="m-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field id="m-body" label={t("platform.messaging.body")}>
          <Input id="m-body" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field id="m-recipients" label={t("platform.messaging.recipients")}>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`m-recipient-${contact.id}`}
                  aria-label={contact.name}
                  checked={contactIds.includes(contact.id)}
                  onCheckedChange={(checked) => toggle(contact.id, Boolean(checked))}
                />
                <span>
                  {contact.name} ({contact.email ?? contact.phone ?? "—"})
                </span>
              </div>
            ))}
          </div>
        </Field>
      </div>
    </FormModal>
  );
}
