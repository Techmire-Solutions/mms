import React from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPagination } from "@/components/ui/ListPagination";
import { useTranslation } from "@/hooks/useTranslation";
import { EnrollmentsListCards } from "@/tenant/features/enrollments/components/EnrollmentsListCards";
import { EnrollmentsListDesktopTable } from "@/tenant/features/enrollments/components/EnrollmentsListDesktopTable";
import type { EnrollmentListContentProps } from "@/tenant/features/enrollments/components/enrollmentListContentShared";
import { Search } from "lucide-react";

export function EnrollmentsListContent(props: EnrollmentListContentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { enrollments, filteredCount, page, pageSize, showDeleted, onPageChange } = props;

  return (
    <>
      {enrollments.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={Search}
          title={showDeleted ? t("enrollments.empty.trashTitle") : t("enrollments.empty.title")}
          description={
            showDeleted ? t("enrollments.empty.trashSubtitle") : t("enrollments.empty.description")
          }
          compact
        />
      ) : props.viewMode === "cards" ? (
        <EnrollmentsListCards {...props} />
      ) : (
        <EnrollmentsListDesktopTable {...props} />
      )}

      <ListPagination
        page={page}
        total={filteredCount}
        limit={pageSize}
        onPageChange={onPageChange}
        i18nNamespace="enrollments"
        variant="summary"
      />
    </>
  );
}
