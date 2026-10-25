import React from "react";
import { FileSignature } from "lucide-react";
import type { Exam } from "@/lib/data/examinationData";
import { useTranslation } from "@/hooks/useTranslation";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { formatDate } from "@mms/shared";

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
      </div>
    </DetailDrawerShell>
  );
};
