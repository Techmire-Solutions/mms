import React, { useState } from "react";
import { Plus, Settings } from "lucide-react";
import { Button, Input } from "@mms/ui";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionCard } from "@/components/app/SectionCard";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { PlatformMessageTemplateDto } from "@mms/contracts";
import {
  useDeletePlatformMessageTemplate,
  usePlatformMessageTemplates,
  useSavePlatformMessageTemplate,
} from "@/platform/features/messaging/hooks/usePlatformMessaging";

import {
  PLATFORM_MESSAGING_CHANNELS,
  PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS,
} from "@/platform/features/messaging/lib/platformMessagingChannels";

/** Messaging → Setup: message templates. */
export function MessagingSetupTier(): React.JSX.Element {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<PlatformMessageTemplateDto | "new" | null>(null);
  const { data: templates } = usePlatformMessageTemplates();
  const save = useSavePlatformMessageTemplate();
  const remove = useDeletePlatformMessageTemplate();

  const renderTemplateRowActions = (template: PlatformMessageTemplateDto) => (
    <div className="flex items-center gap-1.5" role="group" aria-label={template.name}>
      <Button variant="outline" size="sm" onClick={() => setEditing(template)}>
        {t("common.edit")}
      </Button>
      <Button variant="destructive" size="sm" onClick={() => void remove.mutateAsync(template.id)}>
        {t("common.delete")}
      </Button>
    </div>
  );

  const columns: DataTableColumn<PlatformMessageTemplateDto>[] = [
    {
      id: "name",
      kind: "identity",
      label: t("platform.messaging.templateName"),
      render: (row) => row.name,
    },
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
      id: "actions",
      width: 120,
      label: "",
      render: renderTemplateRowActions,
    },
  ];

  return (
    <div className="space-y-4 text-start">
      <SectionCard title={t("platform.messaging.templatesTitle")} icon={Settings}>
        <Button type="button" className="min-h-11" icon={Plus} onClick={() => setEditing("new")}>
          {t("platform.messaging.newTemplate")}
        </Button>
      </SectionCard>

      {templates && templates.length === 0 ? (
        <EmptyState
          title={t("platform.messaging.templatesEmpty")}
          description={t("platform.messaging.templatesEmptyHint")}
        />
      ) : (
        <DataTable
          tableId="platform-message-templates"
          label={t("platform.messaging.templatesTitle")}
          data={templates ?? []}
          columns={columns}
        />
      )}

      {editing ? (
        <TemplateModal
          initial={editing === "new" ? null : editing}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={async (form) => {
            await save.mutateAsync({
              id: editing === "new" ? crypto.randomUUID() : editing.id,
              input: form,
            });
            notify.success(t("platform.messaging.templateSaved"));
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TemplateModal({
  initial,
  saving,
  onClose,
  onSave,
}: {
  initial: PlatformMessageTemplateDto | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: {
    name: string;
    channel: "sms" | "whatsapp" | "email";
    subject?: string | null;
    body: string;
  }) => Promise<void>;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<"sms" | "whatsapp" | "email">(initial?.channel ?? "email");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  return (
    <FormModal
      open
      onClose={onClose}
      title={initial ? t("platform.messaging.editTemplate") : t("platform.messaging.newTemplate")}
      saveLabel={t("common.save")}
      onSave={() => onSave({ name, channel, subject: subject || null, body })}
      isDirty={true}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("settings.unsavedChanges")}
      saving={saving}
      saveDisabled={!name || !body}
    >
      <div className="space-y-4">
        <Field id="t-name" label={t("platform.messaging.templateName")}>
          <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="t-channel" label={t("platform.messaging.channel")}>
          <FormSelect
            id="t-channel"
            name="channel"
            value={channel}
            onChange={(value) => setChannel(value as typeof channel)}
            options={PLATFORM_MESSAGING_CHANNELS.map((c) => ({
              value: c,
              label: t(PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS[c]),
            }))}
          />
        </Field>
        <Field id="t-subject" label={t("platform.messaging.subject")}>
          <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field id="t-body" label={t("platform.messaging.body")}>
          <Input id="t-body" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
      </div>
    </FormModal>
  );
}
