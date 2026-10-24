import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { EmptyState } from "@/components/app/EmptyState";
import { ExaminationsListCards } from "@/tenant/features/examinations/components/ExaminationsListCards";
import { ExaminationsListDesktopTable } from "@/tenant/features/examinations/components/ExaminationsListDesktopTable";
import type { ExaminationsListContentProps } from "@/tenant/features/examinations/lib/examinationsListContentShared";
import { BookOpen } from "lucide-react";

export function ExaminationsListContent(props: ExaminationsListContentProps): React.JSX.Element {
  const { t } = useTranslation();
  const { exams } = props;

  if (exams.length === 0) {
    return (
      <EmptyState
        variant="dashed"
        icon={BookOpen}
        title={t("examinations.empty.exams")}
        description={t("examinations.empty.examsHint")}
        className="py-16"
      />
    );
  }

  return props.viewMode === "cards" ? (
    <ExaminationsListCards {...props} />
  ) : (
    <ExaminationsListDesktopTable {...props} />
  );
}
