import React, { useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import { Button, Input } from "@shared/ui";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { SectionCard } from "@/components/app/SectionCard";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { AppTranslationKey, PlatformContactDto } from "@mms/shared";
import {
  useCreatePlatformContact,
  useDeletePlatformContact,
  usePlatformContacts,
  useUpdatePlatformContact,
} from "@/platform/features/contacts/hooks/usePlatformContacts";
import { exportPlatformContactsCsv } from "@/platform/features/contacts/lib/exportPlatformContactsCsv";

const KIND_OPTIONS = ["platform_operator", "workspace_admin", "external"] as const;

const KIND_LABEL_KEYS: Record<(typeof KIND_OPTIONS)[number], AppTranslationKey> = {
  platform_operator: "platform.contacts.kind.platform_operator",
  workspace_admin: "platform.contacts.kind.workspace_admin",
  external: "platform.contacts.kind.external",
};

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  kind: PlatformContactDto["kind"];
  notes: string;
}

const EMPTY_FORM: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  kind: "external",
  notes: "",
};

/** Contacts → Work: platform-wide contact directory. */
export function ContactsWorkTier(): React.JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<PlatformContactDto["kind"] | "">("");
  const [editing, setEditing] = useState<PlatformContactDto | "new" | null>(null);

  const {
    data: contacts,
    isLoading,
    isError,
    refetch,
  } = usePlatformContacts({
    search: search || undefined,
    kind: kind || undefined,
  });
  const create = useCreatePlatformContact();
  const update = useUpdatePlatformContact();
  const remove = useDeletePlatformContact();

  const columns: DataTableColumn<PlatformContactDto>[] = [
    { id: "name", kind: "identity", label: t("platform.contacts.name"), render: (row) => row.name },
    {
      id: "email",
      kind: "email",
      label: t("platform.contacts.email"),
      render: (row) => row.email ?? "—",
    },
    {
      id: "phone",
      kind: "phone",
      label: t("platform.contacts.phone"),
      render: (row) => row.phone ?? "—",
    },
    {
      id: "kind",
      kind: "status",
      label: t("platform.contacts.kind"),
      render: (row) => t(KIND_LABEL_KEYS[row.kind]),
    },
    {
      id: "actions",
      width: 120,
      label: "",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
            {t("common.edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => void remove.mutateAsync(row.id)}
          >
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 text-start">
      <SectionCard title={t("platform.contacts.directory")} icon={Search}>
        <div className="flex flex-wrap items-end gap-3">
          <Field id="contacts-search" label={t("platform.contacts.search")}>
            <Input
              id="contacts-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("platform.contacts.searchHint")}
            />
          </Field>
          <Field id="contacts-kind" label={t("platform.contacts.kind")}>
            <FormSelect
              id="contacts-kind"
              name="kind"
              value={kind}
              onChange={(value) => setKind(value as PlatformContactDto["kind"] | "")}
              options={[
                { value: "", label: t("common.all") },
                ...KIND_OPTIONS.map((o) => ({ value: o, label: t(KIND_LABEL_KEYS[o]) })),
              ]}
            />
          </Field>
          <Button type="button" className="min-h-11" icon={Plus} onClick={() => setEditing("new")}>
            {t("platform.contacts.add")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            icon={Download}
            disabled={!contacts || contacts.length === 0}
            onClick={() => exportPlatformContactsCsv(contacts ?? [])}
            title={t("platform.contacts.exportCsv")}
          >
            {t("platform.contacts.exportCsv")}
          </Button>
        </div>
      </SectionCard>

      {isError ? (
        <ErrorState
          description={t("platform.contacts.loadFailed")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? null : contacts && contacts.length === 0 ? (
        <EmptyState
          title={t("platform.contacts.emptyTitle")}
          description={t("platform.contacts.emptyDescription")}
        />
      ) : (
        <DataTable
          tableId="platform-contacts"
          label={t("platform.contacts.directory")}
          data={contacts ?? []}
          columns={columns}
        />
      )}

      {editing ? (
        <ContactFormModal
          initial={editing === "new" ? null : editing}
          saving={create.isPending || update.isPending}
          onClose={() => setEditing(null)}
          onSave={async (form) => {
            if (editing === "new") {
              await create.mutateAsync({
                name: form.name,
                email: form.email || null,
                phone: form.phone || null,
                kind: form.kind,
                tags: [],
                notes: form.notes || null,
              });
            } else {
              await update.mutateAsync({
                id: editing.id,
                input: {
                  name: form.name,
                  email: form.email || null,
                  phone: form.phone || null,
                  notes: form.notes || null,
                },
              });
            }
            notify.success(t("platform.contacts.saved"));
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ContactFormModal({
  initial,
  saving,
  onClose,
  onSave,
}: {
  initial: PlatformContactDto | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: ContactFormState) => Promise<void>;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [form, setForm] = useState<ContactFormState>(
    initial
      ? {
          name: initial.name,
          email: initial.email ?? "",
          phone: initial.phone ?? "",
          kind: initial.kind,
          notes: initial.notes ?? "",
        }
      : EMPTY_FORM,
  );

  return (
    <FormModal
      open
      onClose={onClose}
      title={initial ? t("platform.contacts.edit") : t("platform.contacts.add")}
      saveLabel={t("common.save")}
      onSave={() => onSave(form)}
      isDirty={true}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("settings.unsavedChanges")}
      saving={saving}
    >
      <div className="space-y-4">
        <Field id="c-name" label={t("platform.contacts.name")}>
          <Input
            id="c-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field id="c-email" label={t("platform.contacts.email")}>
          <Input
            id="c-email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field id="c-phone" label={t("platform.contacts.phone")}>
          <Input
            id="c-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field id="c-kind" label={t("platform.contacts.kind")}>
          <FormSelect
            id="c-kind"
            name="kind"
            value={form.kind}
            onChange={(value) => setForm({ ...form, kind: value as PlatformContactDto["kind"] })}
            options={KIND_OPTIONS.map((o) => ({ value: o, label: t(KIND_LABEL_KEYS[o]) }))}
          />
        </Field>
        <Field id="c-notes" label={t("platform.contacts.notes")}>
          <Input
            id="c-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </div>
    </FormModal>
  );
}
