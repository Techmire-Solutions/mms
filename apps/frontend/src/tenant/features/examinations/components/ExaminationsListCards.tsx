import React from "react";
import { formatDate } from "@mms/shared";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/app/entityCardChrome";
import { DirectoryCardMetaTile } from "@/components/app/DirectoryCardMetaTile";
import { ModuleDirectoryCards } from "@/components/app/ModuleDirectoryCards";
import { EntityCard } from "@/components/app/EntityCard";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { StatusBadge } from "@/components/app/StatusBadge";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { ExaminationsRowActions } from "@/tenant/features/examinations/components/ExaminationsRowActions";
import {
  getExamMeta,
  type ExaminationsListContentProps,
} from "@/tenant/features/examinations/lib/examinationsListContentShared";

export type ExaminationsListCardsProps = Omit<
  ExaminationsListContentProps,
  "getColumnWidth" | "onColumnResize"
>;

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
function ExaminationCard({
  exam,
  props,
  reducedMotion,
}: {
  exam: ExaminationsListCardsProps["exams"][number];
  props: ExaminationsListCardsProps;
  reducedMotion: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const {
    selectedIds,
    isColumnVisible,
    classes,
    enrollments,
    canWrite,
    canDelete,
    showDeleted,
    canTrashRows,
    statusConfig,
    onEdit,
    onToggleSelectedExam,
    onTrashAction,
  } = props;

  /**
   * onView opens the edit form only when allowed — Examinations domain convention
   * (no separate read-only detail drawer; edit IS the view).
   */
  const canViewEdit = canWrite && !showDeleted;
  const { assignedClasses, studentCount } = getExamMeta(exam, classes, enrollments);

  return (
    <DirectoryEntityCard
      entity={exam}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={onToggleSelectedExam}
      onView={canViewEdit ? onEdit : undefined}
      reducedMotion={reducedMotion}
      onCardClick={props.onRowClick ? () => props.onRowClick!(exam.id) : undefined}
      header={{
        displayName: exam.name,
        subtitle: isColumnVisible("subject") ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{exam.subject}</p>
        ) : undefined,
      }}
      viewAriaLabel={t("examinations.editExamAria", { name: exam.name })}
      metadataSlot={
        <EntityCard.MetaGrid>
          {isColumnVisible("date") && (
            <DirectoryCardMetaTile label={t("examinations.columns.exam.date")}>
              {formatDate(exam.date, true)}
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("duration") && (
            <DirectoryCardMetaTile label={t("examinations.columns.exam.duration")}>
              {t("examinations.durationMinutes", { minutes: exam.duration })}
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("totalMarks") && (
            <DirectoryCardMetaTile label={t("examinations.columns.exam.totalMarks")}>
              <span className="font-semibold">{exam.totalMarks}</span>
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("passingMarks") && (
            <DirectoryCardMetaTile label={t("examinations.columns.exam.passingMarks")}>
              {exam.passingMarks}
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("status") && (
            <DirectoryCardMetaTile label={t("examinations.columns.exam.status")}>
              <StatusBadge status={exam.status} config={statusConfig} size="sm" />
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("classes") && (
            <DirectoryCardMetaTile label={t("examinations.columns.exam.classes")}>
              <span className="break-words">
                {assignedClasses.length > 0 ? assignedClasses.map((c) => c.name).join(", ") : "—"}
              </span>
              {studentCount > 0 && (
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {t("examinations.studentCount", { count: studentCount })}
                </span>
              )}
            </DirectoryCardMetaTile>
          )}
          {isColumnVisible("description") && exam.description?.trim() && (
            <DirectoryCardMetaTile label={t("examinations.columns.exam.description")}>
              <span className="line-clamp-2 break-words">{exam.description}</span>
            </DirectoryCardMetaTile>
          )}
        </EntityCard.MetaGrid>
      }
      overflowActions={
        <ExaminationsRowActions
          exam={exam}
          canWrite={canWrite}
          canDelete={canTrashRows}
          showDeleted={showDeleted}
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
          onEdit={onEdit}
          onTrashAction={onTrashAction}
        />
      }
    />
  );
}

export function ExaminationsListCards(props: ExaminationsListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const {
    exams,
    selectedIds,
    canDelete,
    allVisibleSelected,
    someVisibleSelected,
    onToggleSelectAll,
  } = props;

  const pageCountLabel = formatDirectoryPageCountLabel(exams.length, t, {
    singular: "examinations.item.exam",
    plural: "examinations.item.exams",
  });

  return (
    <ModuleDirectoryCards
      items={exams}
      selectedIds={selectedIds}
      onSelectAll={canDelete ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
      allSelected={allVisibleSelected}
      someSelected={someVisibleSelected}
      selectAllLabel={t("examinations.trash.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("examinations.trash.selected", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="examinations-select-cards"
      renderItem={(exam) => (
        <ExaminationCard key={exam.id} exam={exam} props={props} reducedMotion={reducedMotion} />
      )}
    />
  );
}
