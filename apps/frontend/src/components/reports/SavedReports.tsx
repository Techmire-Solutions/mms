import React, { useState } from "react";
import { Bookmark, Plus } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";
import { FormModal } from "@/components/app/FormModal";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/FormPrimitives";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { translateValidationMessage } from "@/lib/forms/translateValidationMessage";
import {
  genericSavedReportCreateSchema,
  type GenericSavedReport,
  type GenericSavedReportCategory,
  type GenericSavedReportCreateInput,
} from "@mms/contracts";
import type { SavedReportsSource } from "@/hooks/useSavedReportsSource";
import { SavedReportCard } from "./SavedReportCard";

interface SavedReportsProps {
  category: GenericSavedReportCategory;
  source: SavedReportsSource<GenericSavedReport, GenericSavedReportCreateInput>;
  filters?: Record<string, unknown>;
  onApplyFilters?: (filters: Record<string, unknown>) => void;
}

/**
 * Generic component for saving, listing, running, and deleting reporting presets.
 * Re-runs filter configurations against live data.
 */
export default function SavedReports({
  category,
  source,
  filters = {},
  onApplyFilters,
}: SavedReportsProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    reports: saved,
    isLoading,
    isError,
    retry,
    createReport,
    deleteReport,
    runReport,
  } = source;

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GenericSavedReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    const trimmedName = name.trim();
    const parsed = genericSavedReportCreateSchema.safeParse({
      name: trimmedName,
      category,
      filters,
    });
    if (!parsed.success) {
      const message = translateValidationMessage(parsed.error.issues[0]?.message, t);
      setNameError(message);
      setFormError(message);
      return;
    }
    setNameError(undefined);
    setFormError(null);

    setSaving(true);
    try {
      await createReport({
        name: trimmedName,
        category,
        filters,
      });
      notify.success(t("reports.saved.saveSuccess"));
      setName("");
      setSaveOpen(false);
      setNameError(undefined);
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("reports.saved.saveDialogTitle"));
      notify.error(t("reports.saved.saveDialogTitle"));
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async (report: GenericSavedReport) => {
    if (!onApplyFilters) return;

    try {
      await runReport(report.id);
      onApplyFilters(report.filters);
      notify.success(t("reports.saved.runSuccess"));
    } catch {
      notify.error(t("reports.saved.staleWarningTitle"));
    }
  };

  /** Card callback is only a request: the destructive confirm owns the mutation. */
  const handleDeleteRequest = (report: GenericSavedReport): void => {
    setPendingDelete(report);
  };

  const handleConfirmDelete = async (): Promise<boolean> => {
    if (!pendingDelete || deleting) return false;
    setDeleting(true);
    try {
      await deleteReport(pendingDelete.id);
      notify.info(t("reports.saved.deleteSuccess"));
      setPendingDelete(null);
      return true;
    } catch {
      notify.error(t("reports.saved.delete"));
      // Keep the dialog open so the retry does not need a second click on the card.
      return false;
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-start">
          <h3 className="text-sm font-semibold text-foreground">{t("reports.saved.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("reports.saved.subtitle")}</p>
        </div>
        {onApplyFilters && (
          <Button
            variant="capsPrimary"
            size="caps"
            onClick={() => setSaveOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("reports.saved.saveCurrent")}
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState
          title={t("errors.state.generic")}
          description={t("common.retry")}
          onRetry={retry}
          compact
        />
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={t("reports.saved.emptyTitle")}
          description={t("reports.saved.emptyDescription")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {saved.map((report) => (
              <SavedReportCard
                key={report.id}
                report={report}
                onRun={onApplyFilters ? handleRun : undefined}
                onDelete={handleDeleteRequest}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConfirmAlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("reports.saved.deleteConfirmTitle")}
        description={t("reports.saved.deleteConfirmDescription", {
          name: pendingDelete?.name ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleConfirmDelete}
        destructive
      />

      <FormModal
        open={saveOpen}
        onClose={() => {
          setSaveOpen(false);
          setNameError(undefined);
          setFormError(null);
        }}
        title={t("reports.saved.saveDialogTitle")}
        size="sm"
        cancelLabel={t("common.cancel")}
        saveLabel={t("reports.saved.save")}
        onSave={() => void handleSave()}
        saving={saving}
        saveDisabled={saving || !name.trim() || Boolean(nameError)}
        error={formError ?? undefined}
        isDirty={name.trim().length > 0}
        formId="save-report-modal-form"
      >
        <form
          id="save-report-modal-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && !saving) void handleSave();
          }}
          className="space-y-4"
        >
          <Field
            id="saved-report-name"
            label={t("reports.saved.nameLabel")}
            required
            error={nameError}
          >
            <Input
              id="saved-report-name"
              name="name"
              value={name}
              maxLength={200}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError(undefined);
                if (formError) setFormError(null);
              }}
              placeholder={t("reports.saved.namePlaceholder")}
            />
          </Field>
        </form>
      </FormModal>
    </div>
  );
}
