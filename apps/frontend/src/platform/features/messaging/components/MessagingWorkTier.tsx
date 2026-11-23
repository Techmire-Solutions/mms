import React, { useState } from "react";
import { Download, Plus } from "lucide-react";
import { Badge, Button, Input, Checkbox } from "@shared/ui";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { SectionCard } from "@/components/app/SectionCard";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { AppTranslationKey, PlatformMessageDto } from "@mms/shared";
import {
  usePlatformMessages,
  useSendPlatformMessage,
} from "@/platform/features/messaging/hooks/usePlatformMessaging";
import { exportPlatformMessagesCsv } from "@/platform/features/messaging/lib/exportPlatformMessagesCsv";
import { usePlatformContacts } from "@/platform/features/contacts/hooks/usePlatformContacts";

const CHANNEL_OPTIONS = ["sms", "whatsapp", "email"] as const;
const CHANNEL_LABEL_KEYS: Record<(typeof CHANNEL_OPTIONS)[number], AppTranslationKey> = {
  sms: "platform.messaging.channel.sms",
  whatsapp: "platform.messaging.channel.whatsapp",
  email: "platform.messaging.channel.email",
};
const STATUS_LABEL_KEYS: Record<PlatformMessageDto["status"], AppTranslationKey> = {
  queued: "platform.messaging.status.queued",
  sending: "platform.messaging.status.sending",
  sent: "platform.messaging.status.sent",
  delivered: "platform.messaging.status.delivered",
  failed: "platform.messaging.status.failed",
};

/** Messaging → Work: broadcast log + composer. */
export function MessagingWorkTier(): React.JSX.Element {
  const { t } = useTranslation();
  const [composeOpen, setComposeOpen] = useState(false);

  const { data: messages, isLoading, isError, refetch } = usePlatformMessages();
  const send = useSendPlatformMessage();

  const columns: DataTableColumn<PlatformMessageDto>[] = [
    {
      id: "channel",
      kind: "status",
      label: t("platform.messaging.channel"),
      render: (row) => row.channel,
    },
    {
      id: "subject",
      kind: "shortText",
      label: t("platform.messaging.subject"),
      render: (row) => row.subject ?? "—",
    },
    {
      id: "status",
      kind: "status",
      label: t("platform.messaging.status"),
      render: (row) => t(STATUS_LABEL_KEYS[row.status]),
    },
    {
      id: "recipients",
      kind: "number",
      label: t("platform.messaging.recipients"),
      render: (row) => String(row.recipientSnapshot.length),
    },
    {
      id: "createdAt",
      kind: "date",
      label: t("platform.messaging.createdAt"),
      render: (row) => row.createdAt,
    },
  ];

  return (
    <div className="space-y-4 text-start">
      <SectionCard title={t("platform.messaging.log")} icon={Plus}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="min-h-11"
            icon={Plus}
            onClick={() => setComposeOpen(true)}
          >
            {t("platform.messaging.compose")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            icon={Download}
            disabled={!messages || messages.length === 0}
            onClick={() => exportPlatformMessagesCsv(messages ?? [])}
            title={t("platform.messaging.exportCsv")}
          >
            {t("platform.messaging.exportCsv")}
          </Button>
        </div>
      </SectionCard>

      {isError ? (
        <ErrorState
          description={t("platform.messaging.loadFailed")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? null : messages && messages.length === 0 ? (
        <EmptyState
          title={t("platform.messaging.emptyTitle")}
          description={t("platform.messaging.emptyDescription")}
        />
      ) : (
        <DataTable
          tableId="platform-messages"
          label={t("platform.messaging.log")}
          data={messages ?? []}
          columns={columns}
          card={{
            title: (row) => row.subject ?? row.channel,
            badge: (row) => (
              <Badge tone="muted" size="sm">
                {t(STATUS_LABEL_KEYS[row.status])}
              </Badge>
            ),
          }}
        />
      )}

      {composeOpen ? (
        <ComposeModal
          saving={send.isPending}
          onClose={() => setComposeOpen(false)}
          onSend={async (input) => {
            await send.mutateAsync(input);
            notify.success(t("platform.messaging.sent"));
            setComposeOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ComposeModal({
  saving,
  onClose,
  onSend,
}: {
  saving: boolean;
  onClose: () => void;
  onSend: (input: {
    channel: "sms" | "whatsapp" | "email";
    subject?: string | null;
    body: string;
    contactIds: string[];
  }) => Promise<void>;
}): React.JSX.Element {
  const { t } = useTranslation();
  const { data: contacts = [] } = usePlatformContacts({ limit: 500 });
  const [channel, setChannel] = useState<"sms" | "whatsapp" | "email">("email");
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
            onChange={(value) => setChannel(value as typeof channel)}
            options={CHANNEL_OPTIONS.map((c) => ({ value: c, label: t(CHANNEL_LABEL_KEYS[c]) }))}
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
