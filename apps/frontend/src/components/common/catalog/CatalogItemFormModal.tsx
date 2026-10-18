import React, { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import {
  academicCatalogNameKey,
  type AcademicCatalogItem,
  type AcademicCatalogKind,
  type AcademicCatalogStatus,
  type AcademicCatalogWrite,
} from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormModal } from "@/components/app/FormModal";
import { FormSelect } from "@/components/app/FormSelect";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";

export interface CatalogItemFormModalProps {
  open: boolean;
  kind: AcademicCatalogKind;
  /** Row being edited; null creates a new entry. */
  entry: AcademicCatalogItem | null;
  /** Prefill for quick-create (e.g. the text typed into a picker). */
  initialName?: string;
  existing: readonly AcademicCatalogItem[];
  isPending: boolean;
  onClose: () => void;
  /** Resolves true when saved (modal closes), false to keep it open. */
  onSave: (body: AcademicCatalogWrite) => Promise<boolean>;
}

/** Create/edit one academic catalog entry (session category, program or subject). */
export function CatalogItemFormModal({
  open,
  kind,
  entry,
  initialName = "",
  existing,
  isPending,
  onClose,
  onSave,
}: CatalogItemFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const item = t(`academicCatalog.kind.${kind}.singular`);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [shortName, setShortName] = useState("");
  const [status, setStatus] = useState<AcademicCatalogStatus>("active");

  useEffect(() => {
    if (!open) return;
    setName(entry?.name ?? initialName);
    setCode(entry?.code ?? "");
    setShortName(entry?.shortName ?? "");
    setStatus(entry?.status ?? "active");
  }, [open, entry, initialName]);

  const key = academicCatalogNameKey(name);
  const duplicate =
    Boolean(key) &&
    existing.some(
      (row) => row.id !== entry?.id && !row.deletedAt && academicCatalogNameKey(row.name) === key,
    );
  const isDirty = entry
    ? name !== entry.name ||
      code !== (entry.code ?? "") ||
      shortName !== (entry.shortName ?? "") ||
      status !== entry.status
    : Boolean(name.trim() || code.trim() || shortName.trim());

  const handleSave = async () => {
    if (!key || duplicate) return;
    const saved = await onSave({
      name: name.trim(),
      code: code.trim() || null,
      shortName: shortName.trim() || null,
      status,
    });
    if (saved) onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={entry ? t("academicCatalog.edit", { item }) : t("academicCatalog.add", { item })}
      subtitle={t("academicCatalog.formSubtitle")}
      icon={ListPlus}
      size="md"
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      saving={isPending}
      saveDisabled={isPending || !key || duplicate}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("academicCatalog.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      onSave={() => void handleSave()}
    >
      <div className="space-y-4 py-1 text-start">
        <Field
          label={t("academicCatalog.name")}
          id="catalog-form-name"
          required
          error={duplicate ? t("academicCatalog.duplicateName") : undefined}
        >
          <Input
            id="catalog-form-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FORM_INPUT}
            maxLength={150}
            disabled={isPending}
            aria-invalid={duplicate || undefined}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("academicCatalog.code")} id="catalog-form-code">
            <Input
              id="catalog-form-code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={FORM_INPUT}
              maxLength={32}
              disabled={isPending || Boolean(entry?.isSystem)}
            />
          </Field>
          <Field label={t("academicCatalog.shortName")} id="catalog-form-short-name">
            <Input
              id="catalog-form-short-name"
              name="shortName"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              className={FORM_INPUT}
              maxLength={32}
              disabled={isPending}
            />
          </Field>
        </div>
        <Field label={t("common.status")} id="catalog-form-status" required>
          <FormSelect
            id="catalog-form-status"
            name="status"
            value={status}
            onChange={(value) => setStatus(value === "archived" ? "archived" : "active")}
            options={[
              { value: "active", label: t("academicCatalog.status.active") },
              { value: "archived", label: t("academicCatalog.status.archived") },
            ]}
            disabled={isPending}
          />
        </Field>
      </div>
    </FormModal>
  );
}
