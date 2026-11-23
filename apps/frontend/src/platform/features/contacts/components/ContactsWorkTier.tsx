import React, { useState } from "react";
import { Download, Plus, RotateCcw, Search, Users } from "lucide-react";
import { Button, Input } from "@shared/ui";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { ModuleTrashToggle } from "@/components/app/ModuleTrashToggle";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { notify } from "@/lib/notify";
import type { PlatformContactDto } from "@mms/shared";
import {
  useCreatePlatformContact,
  useDeletePlatformContact,
  usePlatformContacts,
  useRestorePlatformContact,
  useUpdatePlatformContact,
} from "@/platform/features/contacts/hooks/usePlatformContacts";
import {
  ContactFormModal,
  type ContactFormState,
} from "@/platform/features/contacts/components/ContactFormModal";
import {
  PLATFORM_CONTACT_KINDS,
  PLATFORM_CONTACT_KIND_LABEL_KEYS,
} from "@/platform/features/contacts/lib/platformContactKinds";
import { exportPlatformContactsCsv } from "@/platform/features/contacts/lib/exportPlatformContactsCsv";

/** Contacts → Work: platform-wide contact directory (table/cards, selection, bulk, trash). */
export function ContactsWorkTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { viewingDeleted, toggleTrash } = useDirectoryTrashState();
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
    deleted: viewingDeleted,
  });
  const create = useCreatePlatformContact();
  const update = useUpdatePlatformContact();
  const remove = useDeletePlatformContact();
  const restore = useRestorePlatformContact();

  const {
    selectedIds,
    visibleIds,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
  } = useWorkSelection(contacts ?? []);

  const handleBulkDelete = async (): Promise<void> => {
    await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
    clearSelection();
  };

  const handleBulkRestore = async (): Promise<void> => {
    await Promise.all(selectedIds.map((id) => restore.mutateAsync(id)));
    clearSelection();
  };

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
      render: (row) => t(PLATFORM_CONTACT_KIND_LABEL_KEYS[row.kind]),
    },
    {
      id: "actions",
      width: 120,
      label: "",
      render: (row) =>
        viewingDeleted ? (
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={() => void restore.mutateAsync(row.id)}
          >
            {t("common.restore")}
          </Button>
        ) : (
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
                ...PLATFORM_CONTACT_KINDS.map((o) => ({
                  value: o,
                  label: t(PLATFORM_CONTACT_KIND_LABEL_KEYS[o]),
                })),
              ]}
            />
          </Field>
          {!viewingDeleted ? (
            <>
              <Button
                type="button"
                className="min-h-11"
                icon={Plus}
                onClick={() => setEditing("new")}
              >
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
            </>
          ) : null}
          <ModuleTrashToggle
            viewingDeleted={viewingDeleted}
            onToggle={() => {
              clearSelection();
              toggleTrash();
            }}
            activeLabel={t("platform.contacts.directory")}
            deletedLabel={t("platform.contacts.trash")}
          />
        </div>
      </SectionCard>

      <BulkSelectionBar
        selectedCount={selectedIds.length}
        viewingDeleted={viewingDeleted}
        canDelete
        leadingIcon={Users}
        i18nNamespace="platform.contacts"
        onClearSelection={clearSelection}
        deleteLabel={t("common.delete")}
        onRequestBulkDelete={() => void handleBulkDelete()}
        onRequestBulkRestore={() => void handleBulkRestore()}
        restoreLabel={t("common.restore")}
      />

      {isError ? (
        <ErrorState
          description={t("platform.contacts.loadFailed")}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? null : contacts && contacts.length === 0 ? (
        <EmptyState
          title={viewingDeleted ? t("platform.contacts.trash") : t("platform.contacts.emptyTitle")}
          description={
            viewingDeleted ? t("platform.contacts.trash") : t("platform.contacts.emptyDescription")
          }
        />
      ) : (
        <DataTable
          tableId="platform-contacts"
          label={t("platform.contacts.directory")}
          data={contacts ?? []}
          columns={columns}
          selection={{
            selectedIds,
            onSelectOne: (id) => toggleSelected(id, !selectedIds.includes(id)),
            onSelectAll: () => toggleSelectAll(!allVisibleSelected, visibleIds),
            allSelected: allVisibleSelected,
            someSelected: someVisibleSelected,
          }}
        />
      )}

      {editing ? (
        <ContactFormModal
          initial={editing === "new" ? null : editing}
          saving={create.isPending || update.isPending}
          onClose={() => setEditing(null)}
          onSave={async (form: ContactFormState) => {
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
