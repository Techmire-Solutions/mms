import type { JSX } from "react";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/app/entityCardChrome";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { QuestionsRowActions } from "@/tenant/features/question-bank/components/QuestionsRowActions";
import {
  renderQuestionMetaChip,
  SYSTEM_FIELD_IDS,
} from "@/tenant/features/question-bank/components/questionsListShared";
import type { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { QuestionCardAnswerPreview } from "./QuestionCardAnswerPreview";

type QuestionBankConfig = ReturnType<typeof useQuestionBankConfig>;
type QuestionBankField = QuestionBankConfig["orderedFields"][number];

export interface QuestionCardProps {
  question: Question;
  config: QuestionBankConfig;
  difficultyConfig: Record<string, StatusBadgeConfigItem>;
  typeConfig: Record<string, StatusBadgeConfigItem>;
  listMetaFields: QuestionBankField[];
  selectedIds: string[];
  canWrite: boolean;
  canDelete: boolean;
  canTrashRows: boolean;
  showDeleted: boolean;
  showSourceCitation: boolean;
  isColumnVisible: (key: string) => boolean;
  onEditQuestion: (question: Question) => void;
  onTrashAction: (id: string) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onRowClick?: (id: string) => void;
  reducedMotion: boolean;
}

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
export function QuestionCard({
  question,
  config,
  difficultyConfig,
  typeConfig,
  listMetaFields,
  selectedIds,
  canWrite,
  canDelete,
  canTrashRows,
  showDeleted,
  showSourceCitation,
  isColumnVisible,
  onEditQuestion,
  onTrashAction,
  onToggleSelected,
  onRowClick,
  reducedMotion,
}: QuestionCardProps): JSX.Element {
  const { t } = useTranslation();
  const canEdit = canWrite && !showDeleted;

  const visibleCustomFields = config.orderedFields.filter(
    (field) =>
      !SYSTEM_FIELD_IDS.has(field.id) &&
      config.isFieldEnabled(field.id) &&
      isColumnVisible(field.id),
  );

  return (
    <DirectoryEntityCard
      entity={question}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={onToggleSelected}
      onView={canEdit ? onEditQuestion : undefined}
      reducedMotion={reducedMotion}
      onCardClick={onRowClick ? () => onRowClick(question.id) : undefined}
      header={{
        displayName: question.text,
        subtitle:
          listMetaFields.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {listMetaFields.map((field) =>
                renderQuestionMetaChip(question, field.id, config, difficultyConfig, typeConfig),
              )}
            </div>
          ) : undefined,
      }}
      viewAriaLabel={t("questionBank.editQuestionAria", { text: question.text })}
      overflowActions={
        <QuestionsRowActions
          question={question}
          canWrite={canWrite}
          canDelete={canDelete}
          canTrashRows={canTrashRows}
          showDeleted={showDeleted}
          hideViewItem
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
          onEditQuestion={onEditQuestion}
          onTrashAction={onTrashAction}
        />
      }
    >
      <QuestionCardAnswerPreview
        question={question}
        config={config}
        showSourceCitation={showSourceCitation}
        visibleCustomFields={visibleCustomFields}
        t={t}
      />
    </DirectoryEntityCard>
  );
}
