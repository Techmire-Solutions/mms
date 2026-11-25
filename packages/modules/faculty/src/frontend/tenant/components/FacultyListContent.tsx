import React from "react";
import { School } from "lucide-react";
import { ModuleWorkDirectoryEmpty } from "@mms/ui/app/ModuleWorkDirectoryEmpty";
import { useTranslation } from "@mms/fe-core/i18n";
import { FacultyListCards } from "./FacultyListCards";
import { FacultyListDesktopTable } from "./FacultyListDesktopTable";
import { buildFacultyCustomFieldsById } from "../lib/facultyListVisibleColumns";
import type { FacultyListContentProps } from "../lib/facultyListContentShared";

export type { FacultyListContentProps } from "../lib/facultyListContentShared";

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
