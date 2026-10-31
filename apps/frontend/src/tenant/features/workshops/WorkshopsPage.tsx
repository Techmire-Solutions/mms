import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, Presentation } from "lucide-react";
import {
  WORKSHOPS_MODULE_MANIFEST,
  type WorkshopEvent,
  type WorkshopEventCreate,
} from "@mms/shared";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { ResponsiveAccordionTabs } from "@/components/app/ResponsiveAccordionTabs";
import { Button } from "@/components/ui/button";
import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { useWorkSelection } from "@/hooks/useWorkSelection";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleShortcuts } from "@/hooks/useModuleShortcuts";
import { notify } from "@/lib/notify";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  useCreateWorkshop,
  useDeleteWorkshop,
  useRestoreWorkshop,
  useUpdateWorkshop,
  useWorkshopMetrics,
  useWorkshops,
} from "@/tenant/hooks/collections/workshops";
import { WORKSHOPS_SEARCH_INPUT_ID, WorkshopsWorkTab } from "./components/WorkshopsWorkTab";
import { WorkshopsReportsTab } from "./components/WorkshopsReportsTab";
import { WorkshopFormModal } from "./components/WorkshopFormModal";
import { WorkshopsSetupTab } from "./components/WorkshopsSetupTab";
import { useWorkshopPreferences } from "./hooks/useWorkshopsCompletionApi";

type Tier = (typeof WORKSHOPS_MODULE_MANIFEST.tiers)[number];

export default function WorkshopsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tier>("work");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkshopEvent | null>(null);
  const [formSession, setFormSession] = useState(0);
  const [search, setSearch] = useState("");
  const [viewingDeleted, setViewingDeleted] = useDirectoryTrashState();
  const { selectedIds, toggleSelected, toggleSelectAll, clearSelection } =
    useWorkSelection<string>();
  const { canRead, canWrite, canDelete, canViewSetup, canEditSetup } =
    useModulePermissions(WORKSHOPS_MODULE_MANIFEST);
  // Setup defaults prefill a new workshop's completion criteria.
  const { data: preferences } = useWorkshopPreferences({ enabled: canWrite });

  const list = useWorkshops({ includeDeleted: viewingDeleted, search });
  const { data: metrics } = useWorkshopMetrics({ enabled: !viewingDeleted });
  const createWorkshop = useCreateWorkshop();
  const updateWorkshop = useUpdateWorkshop();
  const deleteWorkshop = useDeleteWorkshop();
  const restoreWorkshop = useRestoreWorkshop();

  const openCreate = () => {
    if (!canWrite || viewingDeleted) return;
    setEditing(null);
    setFormSession((n) => n + 1);
    setFormOpen(true);
  };
  useModuleShortcuts({
    enabled: activeTab === "work",
    canWrite,
    showDeleted: viewingDeleted,
    onCreate: openCreate,
    searchInputId: WORKSHOPS_SEARCH_INPUT_ID,
    clearSelection,
  });

  const handleSave = async (input: WorkshopEventCreate) => {
    if (editing) await updateWorkshop.mutateAsync({ id: editing.id, body: input });
    else await createWorkshop.mutateAsync(input);
    notify.success(t("workshops.saved"));
  };

  const handleRestore = (id: string) => {
    restoreWorkshop.mutate(id, {
      onSuccess: () => notify.success(t("workshops.restored")),
      onError: (err) =>
        notify.error(err instanceof Error ? err.message : t("workshops.restoreFailed")),
    });
  };

  const handleDelete = (ids: string[]) => {
    for (const id of ids) {
      deleteWorkshop.mutate(id, {
        onSuccess: () =>
          notify.archivedWithUndo(t("common.recordArchived"), () => handleRestore(id)),
        onError: (err) =>
          notify.error(err instanceof Error ? err.message : t("workshops.deleteFailed")),
      });
    }
  };

  const tabs = [
    { id: "work" as const, label: t("nav.workshops") },
    ...(canRead ? [{ id: "reports" as const, label: t("module.reports") }] : []),
    ...(canViewSetup ? [{ id: "setup" as const, label: t("module.setup") }] : []),
  ];

  return (
    <ModulePageShell
      seoTitle={`MMS - ${t("nav.workshops")}`}
      seoDescription={t("page.workshops.subtitle")}
      headerIcon={Presentation}
      headerTitle={t("nav.workshops")}
      headerSubtitle={t("page.workshops.subtitle")}
      headerActions={
        canWrite && !viewingDeleted ? (
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            {t("workshops.create")}
          </Button>
        ) : null
      }
      metricsStrip={
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
          <span>
            {t("workshops.metrics.upcoming")}:{" "}
            <strong className="text-foreground">{metrics?.upcoming ?? 0}</strong>
          </span>
          <span>
            {t("workshops.metrics.ongoing")}:{" "}
            <strong className="text-foreground">{metrics?.ongoing ?? 0}</strong>
          </span>
          <span>
            {t("workshops.metrics.participants")}:{" "}
            <strong className="text-foreground">{metrics?.participants ?? 0}</strong>
          </span>
        </div>
      }
    >
      <ResponsiveAccordionTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab === "reports" || tab === "setup" ? tab : "work")}
        panelIdPrefix="workshops-tab"
      >
        <AnimatePresence mode="wait">
          <ModuleTierMotion tier={activeTab} className="space-y-4">
            {activeTab === "work" ? (
              <WorkshopsWorkTab
                workshops={list.data?.workshops ?? []}
                isLoading={list.isLoading}
                isError={list.isError}
                onRetry={() => void list.refetch()}
                search={search}
                onSearchChange={setSearch}
                canWrite={canWrite && !viewingDeleted}
                canDelete={canDelete}
                viewingDeleted={viewingDeleted}
                selectedIds={selectedIds}
                onToggleSelected={toggleSelected}
                onToggleSelectAll={toggleSelectAll}
                onClearSelection={clearSelection}
                onToggleTrash={(next) => {
                  setViewingDeleted(next);
                  clearSelection();
                }}
                onEdit={(workshop) => {
                  setEditing(workshop);
                  setFormSession((n) => n + 1);
                  setFormOpen(true);
                }}
                onDelete={handleDelete}
                onRestore={handleRestore}
              />
            ) : null}
            {activeTab === "reports" && canRead ? <WorkshopsReportsTab /> : null}
            {activeTab === "setup" && canViewSetup ? (
              <WorkshopsSetupTab canEditSetup={canEditSetup} />
            ) : null}
          </ModuleTierMotion>
        </AnimatePresence>
      </ResponsiveAccordionTabs>

      <WorkshopFormModal
        key={formSession}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initialData={editing}
        defaults={preferences ?? null}
        onSave={handleSave}
      />
    </ModulePageShell>
  );
}
