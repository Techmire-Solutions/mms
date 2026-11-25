import React, { useState } from "react";
import { Download, Plus, RotateCcw, Search, Upload, Users } from "lucide-react";
import { Badge, Button } from "@mms/ui";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { BulkSelectionBar } from "@/components/app/BulkSelectionBar";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { SectionCard } from "@/components/app/SectionCard";
import { ModuleTrashToggle } from "@/components/app/ModuleTrashToggle";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { notify } from "@/lib/notify";
import type { PlatformContactDto } from "@mms/contracts";
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
import { ContactDetailDrawer } from "@/platform/features/contacts/components/ContactDetailDrawer";
import { ContactImportDialog } from "@/platform/features/contacts/components/ContactImportDialog";
import {
  PLATFORM_CONTACT_KINDS,
  PLATFORM_CONTACT_KIND_LABEL_KEYS,
} from "@/platform/features/contacts/lib/platformContactKinds";
import { exportPlatformContactsCsv } from "@/platform/features/contacts/lib/exportPlatformContactsCsv";

/** Contacts → Work: platform-wide contact directory (table/cards, selection, bulk, trash). */
export function ContactsWorkTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { viewingDeleted, toggleTrash } = useDirectoryTrashState();
  const [editing, setEditing] = useState<PlatformContactDto | "new" | null>(null);
  const [selected, setSelected] = useState<PlatformContactDto | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const {
    data: contacts,
    isLoading,
    isError,
    refetch,
  } = usePlatformContacts({
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
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                icon={Upload}
                onClick={() => setImportOpen(true)}
              >
                {t("platform.contacts.import")}
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
          card={{
            title: (row) => row.name,
            badge: (row) => (
              <Badge tone="muted" size="sm">
                {t(PLATFORM_CONTACT_KIND_LABEL_KEYS[row.kind])}
              </Badge>
            ),
          }}
          filters={[
            {
              id: "kind",
              label: t("platform.contacts.kind"),
              options: PLATFORM_CONTACT_KINDS.map((o) => ({
                value: o,
                label: t(PLATFORM_CONTACT_KIND_LABEL_KEYS[o]),
              })),
              getValue: (row) => row.kind,
            },
          ]}
          onRowClick={(row) => setSelected(row)}
          selection={{
            selectedIds,
            onSelectOne: (id) => toggleSelected(id, !selectedIds.includes(id)),
            onSelectAll: () => toggleSelectAll(!allVisibleSelected, visibleIds),
            allSelected: allVisibleSelected,
            someSelected: someVisibleSelected,
          }}
        />
      )}

      {importOpen ? (
        <ContactImportDialog
          onClose={() => setImportOpen(false)}
          onImported={(count) => {
            setImportOpen(false);
            notify.success(t("platform.contacts.importSuccess", { count: String(count) }));
          }}
        />
      ) : null}

      {selected && !editing ? (
        <ContactDetailDrawer
          contact={selected}
          onClose={() => setSelected(null)}
          onEdit={(contact) => {
            setSelected(null);
            setEditing(contact);
          }}
          onDelete={(id) => void remove.mutateAsync(id)}
        />
      ) : null}

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
