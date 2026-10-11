import { ACCOUNTING_MODULE_MANIFEST, buildAccountingJournalWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

const STORAGE_SUFFIX = "journal";

export function useAccountingJournalColumnLayout() {
  const { t } = useTranslation();

  const storageModuleId = `${ACCOUNTING_MODULE_MANIFEST.moduleId}_${STORAGE_SUFFIX}`;

  const tenantRegistry = (() =>
    buildAccountingJournalWorkColumnRegistry({
      ref: t("accounting.columns.journal.ref"),
      date: t("accounting.columns.journal.date"),
      description: t("accounting.columns.journal.description"),
      tags: t("accounting.columns.journal.tags"),
      debit: t("accounting.columns.journal.debit"),
      credit: t("accounting.columns.journal.credit"),
      status: t("accounting.columns.journal.status"),
    }))();

  return useModuleColumnLayout({
    moduleId: storageModuleId,
    tenantRegistry,
    apiPath: `${ACCOUNTING_MODULE_MANIFEST.restBasePath}/journal`,
    translationPrefix: "accounting.columns",
  });
}
