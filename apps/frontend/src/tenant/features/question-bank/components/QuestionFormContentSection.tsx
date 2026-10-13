import { BookOpen } from "lucide-react";
import { type QuestionType } from "@mms/shared";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Textarea } from "@/components/ui/textarea";
import { FORM_SELECT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { QuestionFormAnswerFields } from "./QuestionFormAnswerFields";

import type {
  QuestionFormDraft,
  QuestionFormErrors,
  UpdateQuestionDraft,
} from "../lib/questionFormTypes";

interface QuestionFormContentSectionProps {
  questionDraft: QuestionFormDraft;
  errors: QuestionFormErrors;
  updateDraft: UpdateQuestionDraft;
}

export function QuestionFormContentSection({
  questionDraft,
  errors,
  updateDraft,
}: QuestionFormContentSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const trueLabel = t("questionBank.true");
  const falseLabel = t("questionBank.false");

  return (
    <div className="space-y-5 text-start">
      <SectionCard
        accentColor="info"
        icon={BookOpen}
        title={t("questionBank.form.content")}
        className="shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="qb-text" label={t("questionBank.questionText")} required error={errors.text}>
              <Textarea
                id="qb-text"
                name="text"
                value={questionDraft.text || ""}
                onChange={(e) => updateDraft({ text: e.target.value })}
                placeholder={t("questionBank.questionTextPlaceholder")}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field id="qb-type" label={t("questionBank.type")}>
              <FormSelect
                id="qb-type"
                name="type"
                className={FORM_SELECT}
                value={questionDraft.type}
                onChange={(val) => {
                  const nextType = val as QuestionType;
                  const options =
                    nextType === "mcq"
                      ? ["", "", "", ""]
                      : nextType === "true_false"
                        ? [trueLabel, falseLabel]
                        : [];
                  updateDraft({ type: nextType, options, answer: "" });
                }}
                options={[
                  { value: "mcq", label: t("questionBank.type.mcq") },
                  { value: "true_false", label: t("questionBank.type.true_false") },
                  { value: "short", label: t("questionBank.type.short") },
                  { value: "fill_blank", label: t("questionBank.type.fill_blank") },
                  { value: "matching", label: t("questionBank.type.matching") },
                  { value: "ordering", label: t("questionBank.type.ordering") },
                  { value: "numeric", label: t("questionBank.type.numeric") },
                ]}
              />
            </Field>
          </div>

          <QuestionFormAnswerFields
            questionDraft={questionDraft}
            errors={errors}
            updateDraft={updateDraft}
          />
        </div>
      </SectionCard>
    </div>
  );
}
