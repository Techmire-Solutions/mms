import React from "react";
import { School } from "lucide-react";
import { ModuleWorkDirectoryEmpty } from "@/components/ui/ModuleWorkDirectoryEmpty";
import { useTranslation } from "@/hooks/useTranslation";
import { FacultyListCards } from "@/tenant/features/faculty/components/FacultyListCards";
import { FacultyListDesktopTable } from "@/tenant/features/faculty/components/FacultyListDesktopTable";
import { buildFacultyCustomFieldsById } from "@/tenant/features/faculty/components/facultyListVisibleColumns";
import type { FacultyListContentProps } from "@/tenant/features/faculty/components/facultyListContentShared";

export type { FacultyListContentProps } from "@/tenant/features/faculty/components/facultyListContentShared";

export type FacultyListContentInput = Omit<FacultyListContentProps, "customFieldsById">;

export function FacultyListContent(props: FacultyListContentInput): React.JSX.Element {
  const { t } = useTranslation();
  const {
    faculty,
    showDeleted,
    viewMode,
    columnRegistry,
    hasActiveFilters,
    onClearFilters,
    onShowActive,
    canWrite,
  } = props;
  const items = faculty ?? [];
  const customFieldsById = React.useMemo(
    () => buildFacultyCustomFieldsById(columnRegistry),
    [columnRegistry],
  );
  const contentProps: FacultyListContentProps = { ...props, faculty: items, customFieldsById };

  if (items.length === 0) {
    const emptyDescription = hasActiveFilters
      ? t("faculty.tryAdjustingFilters")
      : showDeleted
        ? t("faculty.empty.trashSubtitle")
        : canWrite
          ? t("faculty.clickAddFaculty")
          : t("faculty.emptyDirectoryReadOnly");

    return (
      <ModuleWorkDirectoryEmpty
        icon={School}
        title={
          hasActiveFilters
            ? t("faculty.noFacultyMatchFilters")
            : showDeleted
              ? t("faculty.noDeletedFaculty")
              : t("faculty.empty.title")
        }
        description={emptyDescription}
        hasActiveFilters={hasActiveFilters}
        viewingDeleted={showDeleted}
        onClearFilters={onClearFilters ?? (() => undefined)}
        onShowActive={onShowActive}
        clearFiltersLabel={t("faculty.clearFilters")}
        showActiveLabel={t("faculty.showActive")}
      />
    );
  }

  if (viewMode === "cards") {
    return <FacultyListCards {...contentProps} />;
  }

  return <FacultyListDesktopTable {...contentProps} />;
}
