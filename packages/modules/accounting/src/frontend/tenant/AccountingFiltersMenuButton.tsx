import type { JSX } from "react";
import { Filter } from "lucide-react";
import { ModuleFilterDropdown, ModuleFilterRadioGroup } from "@mms/ui/app/ModuleFiltersMenuButton";
import { useTranslation } from "@mms/fe-core/i18n";
import { JOURNAL_ENTRY_STATUSES, type AppTranslationKey } from "@mms/contracts";
import { JOURNAL_TAGS } from "./index";
import { getJournalTagLabel } from "./index";

interface AccountingFiltersMenuButtonProps {
  statusFilter: string;
  tagFilter: string;
  activeFilterCount: number;
  onChangeStatus: (value: string) => void;
  onChangeTag: (value: string) => void;
  onClearFilters: () => void;
}

/** Accounting Journal Work single Filters menu — status + tag radio groups on shared chrome. */
export function AccountingFiltersMenuButton({
  statusFilter,
  tagFilter,
  activeFilterCount,
  onChangeStatus,
  onChangeTag,
  onClearFilters,
}: AccountingFiltersMenuButtonProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <ModuleFilterDropdown
      label={t("accounting.filters")}
      activeCount={activeFilterCount}
      icon={Filter}
      clearLabel={t("accounting.clearFilters")}
      onClear={onClearFilters}
    >
      <ModuleFilterRadioGroup
        label={t("accounting.journal.dashboard.allStatus")}
        options={[
          { value: "all", label: t("accounting.journal.dashboard.allStatus") },
          // Derived from the shared stored-status enum: a new status needs no UI edit.
          ...JOURNAL_ENTRY_STATUSES.map((status) => ({
            value: status,
            label: t(`accounting.journal.status.${status}` as AppTranslationKey),
          })),
        ]}
        value={statusFilter}
        onValueChange={onChangeStatus}
      />
      <ModuleFilterRadioGroup
        label={t("accounting.journal.dashboard.allTags")}
        options={[
          { value: "all", label: t("accounting.journal.dashboard.allTags") },
          ...JOURNAL_TAGS.map((tag) => ({
            value: tag,
            label: getJournalTagLabel(tag, t),
          })),
        ]}
        value={tagFilter}
        onValueChange={onChangeTag}
      />
    </ModuleFilterDropdown>
  );
}
