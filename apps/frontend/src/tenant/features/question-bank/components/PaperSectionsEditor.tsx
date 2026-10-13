import React from "react";
import { Layers, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { Field, FormCollectionShell, FormListFieldCard } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import type { PaperSection } from "@/tenant/features/question-bank/lib/paperBuilderUtils";

interface PaperSectionsEditorProps {
  activeSectionId: string;
  questionsById: Map<string, Question>;
  sections: PaperSection[];
  selectedCount: number;
  onAddSection: () => void;
  onRemoveQuestion: (sectionId: string, questionId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onSelectSection: (sectionId: string) => void;
  onUpdateSection: (sectionId: string, patch: Partial<PaperSection>) => void;
}

export function PaperSectionsEditor({
  activeSectionId,
  questionsById,
  sections,
  selectedCount,
  onAddSection,
  onRemoveQuestion,
  onRemoveSection,
  onSelectSection,
  onUpdateSection,
}: PaperSectionsEditorProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <FormCollectionShell
      title={
        <div>
          <h3 className="m-0 text-sm font-bold text-foreground">
            {t("questionBank.paperSections")}
          </h3>
          <p className="m-0 text-xs text-muted-foreground">
            {t("questionBank.selectedQuestionCount", { count: selectedCount })}
          </p>
        </div>
      }
      icon={Layers}
      addLabel={t("questionBank.addSection")}
      onAdd={onAddSection}
      listKey="paper-sections"
    >
      {sections.map((section, sectionIndex) => {
        const active = section.id === activeSectionId;
        return (
          <FormListFieldCard
            key={section.id}
            id={section.id}
            index={sectionIndex}
            label={undefined}
            typeSelect={
              <Button
                type="button"
                onClick={() => onSelectSection(section.id)}
                variant={active ? "default" : "outline"}
                size="sm"
                className="px-3 text-xs"
              >
                {t("questionBank.activeSection", { n: sectionIndex + 1 })}
              </Button>
            }
            removeLabel={t("questionBank.removeSectionAria", { title: section.title })}
            canRemove={sections.length > 1}
            onRemove={() => onRemoveSection(section.id)}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`section-title-${section.id}`} label={t("questionBank.sectionTitle")}>
                <Input
                  id={`section-title-${section.id}`}
                  name={`sections.${section.id}.title`}
                  className={`${FORM_INPUT} shadow-none`}
                  value={section.title}
                  onChange={(event) => onUpdateSection(section.id, { title: event.target.value })}
                  placeholder={t("questionBank.sectionTitlePlaceholder")}
                />
              </Field>
              <Field
                id={`section-instructions-${section.id}`}
                label={t("questionBank.sectionInstructions")}
              >
                <Input
                  id={`section-instructions-${section.id}`}
                  name={`sections.${section.id}.instructions`}
                  className={`${FORM_INPUT} shadow-none`}
                  value={section.instructions}
                  onChange={(event) =>
                    onUpdateSection(section.id, { instructions: event.target.value })
                  }
                  placeholder={t("questionBank.sectionInstructionsPlaceholder")}
                />
              </Field>
            </div>

            <div className="mt-3 space-y-2">
              {section.questionIds.length === 0 ? (
                <EmptyState
                  title={t("questionBank.noSectionQuestions")}
                  variant="dashed"
                  compact
                  icon={null}
                  className="rounded-lg"
                />
              ) : (
                section.questionIds.map((questionId, questionIndex) => {
                  const question = questionsById.get(questionId);
                  if (!question) return null;
                  return (
                    <div
                      key={questionId}
                      className="flex min-w-0 items-start gap-2 rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-muted-foreground">
                        {questionIndex + 1}.
                      </span>
                      <p className="m-0 min-w-0 flex-1 break-words text-xs font-semibold leading-snug text-foreground">
                        {question.text}
                      </p>
                      <Button
                        type="button"
                        onClick={() => onRemoveQuestion(section.id, questionId)}
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={t("questionBank.removeQuestionAria", { n: questionIndex + 1 })}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </FormListFieldCard>
        );
      })}
    </FormCollectionShell>
  );
}
