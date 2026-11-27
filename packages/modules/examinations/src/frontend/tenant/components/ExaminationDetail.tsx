import React from "react";
import { FileSignature } from "lucide-react";
import type { Exam } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { DetailDrawerShell } from "@mms/fe-core/components/DetailDrawerShell";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@mms/fe-core/components/DetailDrawerArchiveChrome";
import { DetailSectionCard } from "@mms/fe-core/components/DetailSectionCard";
import { DetailAttributeRow } from "@mms/fe-core/components/DetailAttributeRow";
import { ExamEligibilitySection } from "./ExamEligibilitySection";
import { formatDate } from "@mms/contracts";

export interface ExaminationDetailProps {
  exam: Exam;

  onClose: () => void;
  onEdit?: (exam: Exam) => void;
  canDelete?: boolean;
  onRestore?: (examId: string) => void | Promise<void>;
}

export const ExaminationDetail = function ExaminationDetail({
  exam,
  onClose,
  onEdit,
  canDelete = false,
  onRestore,
}: ExaminationDetailProps): React.JSX.Element {
  const { t } = useTranslation();
  const isArchived = !!exam.deletedAt;

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      title={exam.name}
      icon={FileSignature}
      headerExtra={isArchived ? <DetailDrawerArchivedBanner deletedAt={exam.deletedAt} /> : null}
      headerActions={
        <DetailDrawerRestoreOrEditAction
          isArchived={isArchived}
          canEdit={!!onEdit}
          canRestore={canDelete}
          onEdit={() => onEdit?.(exam)}
          onRestore={() => onRestore?.(exam.id)}
          restoreLabel={t("common.restore")}
          editLabel={t("common.edit")}
        />
      }
    >
      <div className="flex flex-col gap-6 py-6">
        <DetailSectionCard
          title={t("examinations.detail.overview")}
          className="overflow-hidden divide-y divide-border"
        >
          <DetailAttributeRow label={t("examinations.fields.status")} value={exam.status || "—"} />
          <DetailAttributeRow
            label={t("examinations.fields.date")}
            value={exam.date ? formatDate(exam.date) : "—"}
          />
          <DetailAttributeRow
            label={t("examinations.fields.classTargets")}
            value={exam.classIds?.length > 0 ? exam.classIds.join(", ") : "—"}
          />
        </DetailSectionCard>

        {exam.description && (
          <DetailSectionCard title={t("examinations.fields.description")} className="p-4">
            <p className="whitespace-pre-wrap text-sm text-foreground m-0">{exam.description}</p>
          </DetailSectionCard>
        )}

        {!isArchived && (
          <ExamEligibilitySection
            examId={exam.id}
            canManage={canDelete}
            resultsFinalizedAt={exam.resultsFinalizedAt ?? null}
          />
        )}
      </div>
    </DetailDrawerShell>
  );
};
