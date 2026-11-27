import React from "react";
import { useTranslation } from "@mms/fe-core/i18n";
import { EmptyState } from "@mms/ui";
import { ExaminationsListCards } from "./ExaminationsListCards";
import { ExaminationsListDesktopTable } from "./ExaminationsListDesktopTable";
import type { ExaminationsListContentProps } from "../lib/examinationsListContentShared";
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
