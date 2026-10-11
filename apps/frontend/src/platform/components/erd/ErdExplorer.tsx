import type React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { FormSelect } from "@/components/ui/FormSelect";
import { Field } from "@/components/ui/FormField";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { ErdMermaidDiagram } from "@/platform/components/erd/ErdMermaidDiagram";
import { ErdRelationshipList } from "@/platform/components/erd/ErdRelationshipList";
import { useErdPageController } from "@/platform/hooks/useErdPageController";

export function ErdExplorer(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    domainId,
    focusTable,
    visible,
    tableNames,
    domainOptions,
    isLive,
    setDomainId,
    setFocusTable,
  } = useErdPageController();

  const formattedDomainOptions = domainOptions.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));
  const tableOptions = [
    { value: "", label: t("platform.erdAllTables") },
    ...tableNames.map((name) => ({ value: name, label: name })),
  ];

  return (
    <div className="space-y-6">
      <div className={`${WORK_SURFACE} grid gap-4 p-4 sm:grid-cols-2`}>
        <Field label={t("platform.erdDomainLabel")} id="erd-domain">
          <FormSelect
            name="erd-domain"
            aria-label={t("platform.erdDomainLabel")}
            value={domainId}
            onChange={setDomainId}
            options={formattedDomainOptions}
          />
        </Field>
        <Field label={t("platform.erdFocusTable")} id="erd-table">
          <FormSelect
            name="erd-table"
            aria-label={t("platform.erdFocusTable")}
            value={focusTable}
            onChange={setFocusTable}
            options={tableOptions}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>{t("platform.erdTableCount", { count: visible.tables.length })}</p>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {t("platform.liveSchema")}
          </span>
        )}
      </div>

      <ErdMermaidDiagram key={`${domainId}:${focusTable}`} domain={visible} />

      <ErdRelationshipList relationships={visible.relationships} />
    </div>
  );
}
