import type { JSX } from "react";
import { Filter } from "lucide-react";
import {
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/app/ModuleFiltersMenuButton";
import { useTranslation } from "@/hooks/useTranslation";
import { JOURNAL_TAGS } from "@/lib/data/accountingData";
import { getJournalTagLabel } from "@/tenant/features/accounting/lib/journalEntriesListShared";

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
          { value: "posted", label: t("accounting.journal.status.posted") },
          { value: "draft", label: t("accounting.journal.status.draft") },
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
