import React, { type JSX } from "react";
import { CheckSquare } from "lucide-react";
import type {
  MessagingGenderFilter,
  MessagingRoleFilter,
  ModuleColumnRegistryEntry,
} from "@mms/shared";
import { Button } from "@/components/ui/button";
import {
  ModuleFilterDivider,
  ModuleFilterDropdown,
  ModuleFilterRadioGroup,
} from "@/components/app/ModuleFiltersMenuButton";
import { type ModuleColumnCustomizerLabels } from "@/components/app/ModuleColumnCustomizer";
import { FilterChips } from "@/components/app/FilterChips";
import { WORK_TOOLBAR_TRIGGER, WORK_TOOLBAR_TRIGGER_IDLE } from "@/components/ui/formStyles";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { SEMANTIC_TEXT } from "@/lib/ui/semanticTone";
import { WorkTaskToolbar } from "@/components/common/work";

export const MESSAGING_RECIPIENTS_SEARCH_INPUT_ID = "messaging-recipients-search";

export interface MessagingWorkRecipientsToolbarProps {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  searchContact: string;
  genderFilter: MessagingGenderFilter;
  roleFilter: MessagingRoleFilter;
  roleOptions: Array<{ value: string; label: string }>;
  genderOptions: Array<{ value: string; label: string }>;
  selectingReachable: boolean;
  onSearchChange: (value: string) => void;
  onGenderFilterChange: (value: MessagingGenderFilter) => void;
  onRoleFilterChange: (value: MessagingRoleFilter) => void;
  onSelectReachable: (kind: "phone" | "email") => void;
  columnRegistry?: ModuleColumnRegistryEntry[];
  updateUserColumnLayout?: (columns: ModuleColumnRegistryEntry[]) => void;
  onResetColumnLayout?: () => void;
  columnCustomizerLabels?: ModuleColumnCustomizerLabels;
}

export const MessagingWorkRecipientsToolbar = function MessagingWorkRecipientsToolbar({
  viewMode,
  onViewModeChange,
  searchContact,
  genderFilter,
  roleFilter,
  roleOptions,
  genderOptions,
  selectingReachable,
  onSearchChange,
  onGenderFilterChange,
  onRoleFilterChange,
  onSelectReachable,
  columnRegistry,
  updateUserColumnLayout,
  onResetColumnLayout,
  columnCustomizerLabels,
}: MessagingWorkRecipientsToolbarProps): JSX.Element {
  const { t } = useTranslation();
  const defaultRole = roleOptions[0]?.value ?? "all";
  const defaultGender = genderOptions[0]?.value ?? "all";
  const activeFilterCount =
    (roleFilter !== defaultRole ? 1 : 0) + (genderFilter !== defaultGender ? 1 : 0);

  const roleLabel = (value: string): string =>
    roleOptions.find((option) => option.value === value)?.label ?? value;
  const genderLabel = (value: string): string =>
    genderOptions.find((option) => option.value === value)?.label ?? value;

  const clearFilters = (): void => {
    onRoleFilterChange(defaultRole as MessagingRoleFilter);
    onGenderFilterChange(defaultGender as MessagingGenderFilter);
  };

  const chips = [
    ...(roleFilter !== defaultRole
      ? [
          {
            key: `role:${roleFilter}`,
            label: roleLabel(roleFilter),
            onRemove: () => onRoleFilterChange(defaultRole as MessagingRoleFilter),
          },
        ]
      : []),
    ...(genderFilter !== defaultGender
      ? [
          {
            key: `gender:${genderFilter}`,
            label: genderLabel(genderFilter),
            onRemove: () => onGenderFilterChange(defaultGender as MessagingGenderFilter),
          },
        ]
      : []),
  ];

  return (
    <WorkTaskToolbar
      regionLabel={t("messaging.stepSelectRecipients")}
      search={searchContact}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("messaging.search.placeholder")}
      searchId={MESSAGING_RECIPIENTS_SEARCH_INPUT_ID}
      hasActiveFilters={activeFilterCount > 0}
      onClearFilters={clearFilters}
      clearFiltersLabel={t("common.clearFilters")}
      filterButton={
        <ModuleFilterDropdown
          label={t("common.filters")}
          activeCount={activeFilterCount}
          clearLabel={t("common.clearFilters")}
          onClear={clearFilters}
        >
          <ModuleFilterRadioGroup
            label={t("messaging.filterByRole")}
            value={roleFilter}
            onValueChange={(value) => onRoleFilterChange(value as MessagingRoleFilter)}
            options={roleOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />

          <ModuleFilterDivider />
          <ModuleFilterRadioGroup
            label={t("contacts.reportFields.gender")}
            value={genderFilter}
            onValueChange={(value) => onGenderFilterChange(value as MessagingGenderFilter)}
            options={genderOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
        </ModuleFilterDropdown>
      }
      filterChips={<FilterChips chips={chips} onClearAll={clearFilters} />}
      viewModeToggle={{
        viewMode,
        onViewModeChange,
      }}
      columnCustomizer={
        columnRegistry && updateUserColumnLayout
          ? {
              registry: columnRegistry,
              onUpdate: updateUserColumnLayout,
              onReset: onResetColumnLayout,
              labels: columnCustomizerLabels,
            }
          : undefined
      }
    >
      <Button
        type="button"
        variant="outline"
        disabled={selectingReachable}
        onClick={() => onSelectReachable("phone")}
        className={cn(WORK_TOOLBAR_TRIGGER, WORK_TOOLBAR_TRIGGER_IDLE, "text-xs font-semibold")}
      >
        <CheckSquare className={`me-1 h-3.5 w-3.5 ${SEMANTIC_TEXT.info}`} />{" "}
        {t("messaging.selectAllValidPhone")}
      </Button>

      <Button
        type="button"
        variant="outline"
        disabled={selectingReachable}
        onClick={() => onSelectReachable("email")}
        className={cn(WORK_TOOLBAR_TRIGGER, WORK_TOOLBAR_TRIGGER_IDLE, "text-xs font-semibold")}
      >
        <CheckSquare className={`me-1 h-3.5 w-3.5 ${SEMANTIC_TEXT.warning}`} />{" "}
        {t("messaging.selectAllValidEmail")}
      </Button>
    </WorkTaskToolbar>
  );
};
