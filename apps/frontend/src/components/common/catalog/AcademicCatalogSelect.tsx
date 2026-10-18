import React, { useMemo, useState } from "react";
import {
  activeAcademicCatalogItems,
  type AcademicCatalogItem,
  type AcademicCatalogKind,
} from "@mms/shared";
import { FormSelectWithQuickCreate } from "@/components/app/FormSelectWithQuickCreate";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useAcademicCatalogActions,
  useAcademicCatalogItems,
  useExaminationSubjects,
} from "@/hooks/useAcademicCatalog";
import { CatalogItemFormModal } from "./CatalogItemFormModal";

export interface AcademicCatalogSelectProps {
  kind: AcademicCatalogKind;
  /** Selected catalog id ('' for none). */
  value: string;
  onChange: (id: string, item: AcademicCatalogItem | null) => void;
  /** `examinations` reads subjects through the Examinations module (no Sessions grant needed). */
  source?: "sessions" | "examinations";
  /** Show the inline "add" control (requires Sessions setup permission). */
  canCreate?: boolean;
  /** Offer an explicit empty choice. */
  allowNone?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

/** Catalog picker (session category / program / subject) with quick-create when an entry is missing. */
export function AcademicCatalogSelect({
  kind,
  value,
  onChange,
  source = "sessions",
  canCreate = false,
  allowNone = false,
  id,
  name,
  disabled,
  required,
  ...aria
}: AcademicCatalogSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const sessionsQuery = useAcademicCatalogItems(kind, { enabled: source === "sessions" });
  const examQuery = useExaminationSubjects(source === "examinations");
  const rows = useMemo(
    () => (source === "examinations" ? examQuery.data : sessionsQuery.data) ?? [],
    [source, examQuery.data, sessionsQuery.data],
  );
  const actions = useAcademicCatalogActions(kind);
  const item = t(`academicCatalog.kind.${kind}.singular`);

  const options = useMemo(() => {
    const active = activeAcademicCatalogItems(rows);
    const selected = rows.find((row) => row.id === value);
    const list = selected && !active.includes(selected) ? [...active, selected] : active;
    const mapped = list.map((row) => ({
      value: row.id,
      label: row.shortName ? `${row.name} (${row.shortName})` : row.name,
    }));
    return allowNone ? [{ value: "", label: t("academicCatalog.none") }, ...mapped] : mapped;
  }, [rows, value, allowNone, t]);

  return (
    <>
      <FormSelectWithQuickCreate
        id={id}
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={aria["aria-invalid"]}
        aria-label={aria["aria-label"]}
        placeholder={t("academicCatalog.select", { item })}
        options={options}
        onChange={(next) => onChange(next, rows.find((row) => row.id === next) ?? null)}
        canAdd={canCreate}
        onOpenAdd={() => setCreateOpen(true)}
        addAriaLabel={t("academicCatalog.add", { item })}
      />
      {canCreate ? (
        <CatalogItemFormModal
          open={createOpen}
          kind={kind}
          entry={null}
          existing={rows}
          isPending={actions.isPending}
          onClose={() => setCreateOpen(false)}
          onSave={async (body) => {
            const created = await actions.save(undefined, body);
            if (created) onChange(created.id, created);
            return created !== null;
          }}
        />
      ) : null}
    </>
  );
}
