import React from "react";
import {
  QUESTION_SOURCE_FIELD_TO_KEY,
  getBookCitationFieldIds,
  isQuestionSourceFieldId,
  type AppTranslationKey,
  type ModuleFieldDef,
  type QuestionBookCitation,
  type QuestionSourceBook,
  type QuestionSourceReference,
} from "@mms/shared";
import { FORM_INPUT } from "@/components/ui/formStyles";
import {
  Field,
  FormCollectionShell,
  FormListFieldCard,
  FormSelectWithQuickCreate,
} from "@/components/app/FormPrimitives";
import { QuestionSourceInput } from "@/tenant/features/question-bank/components/QuestionSourceInput";

type TranslateFn = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

interface QuestionSourcesCitationsSectionProps {
  sourceBooks: QuestionSourceBook[];
  citationEntries: QuestionBookCitation[];
  fieldById: Map<string, ModuleFieldDef>;
  fieldLabel: (fieldId: string, fallback?: string) => string;
  t: TranslateFn;
  canAddBook?: boolean;
  onOpenAddBook?: (citationIndex: number) => void;
  onUpdateCitation: (index: number, patch: Partial<QuestionBookCitation>) => void;
  onUpdateCitationField: (index: number, key: keyof QuestionSourceReference, value: string) => void;
  onAddCitation: () => void;
  onRemoveCitation: (index: number) => void;
}

export function QuestionSourcesCitationsSection({
  sourceBooks,
  citationEntries,
  fieldById,
  fieldLabel,
  t,
  canAddBook = false,
  onOpenAddBook,
  onUpdateCitation,
  onUpdateCitationField,
  onAddCitation,
  onRemoveCitation,
}: QuestionSourcesCitationsSectionProps): React.JSX.Element {
  const sourceBooksById = new Map(sourceBooks.map((sourceBook) => [sourceBook.id, sourceBook]));

  if (sourceBooks.length === 0 && !canAddBook) {
    return (
      <section className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t("questionBank.citationsForQuestionHint")}
        </p>
        <p className="text-sm text-muted-foreground">{t("questionBank.addBookBeforeCitation")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("questionBank.citationsForQuestionHint")}</p>
      <FormCollectionShell
        addLabel={t("questionBank.addBookCitation")}
        onAdd={onAddCitation}
        listKey="qb-citations"
      >
        {citationEntries.map((entry, index) => {
          const book = sourceBooksById.get(entry.bookId);
          const citationFieldIds = book ? getBookCitationFieldIds(book) : [];

          return (
            <FormListFieldCard
              key={index}
              id={`qb-citation-${index}`}
              index={index}
              label={t("questionBank.citationEntry", { n: index + 1 })}
              removeLabel={t("questionBank.removeCitation")}
              canRemove={citationEntries.length > 1 && Boolean(entry.bookId)}
              onRemove={() => onRemoveCitation(index)}
            >
              <Field id={`qb-citation-book-${index}`} label={t("questionBank.selectSourceBook")}>
                <FormSelectWithQuickCreate
                  id={`qb-citation-book-${index}`}
                  className={FORM_INPUT}
                  value={entry.bookId}
                  onChange={(val) => onUpdateCitation(index, { bookId: val, citation: {} })}
                  placeholder={t("questionBank.selectSourceBook")}
                  options={sourceBooks.map((b) => ({ value: b.id, label: b.name }))}
                  canAdd={canAddBook}
                  onOpenAdd={onOpenAddBook ? () => onOpenAddBook(index) : undefined}
                  addAriaLabel={t("questionBank.addSourceBook")}
                />
              </Field>

              {book && citationFieldIds.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {citationFieldIds.map((fieldId) => {
                    const field = fieldById.get(fieldId);
                    if (!field || !isQuestionSourceFieldId(fieldId)) return null;
                    const key = QUESTION_SOURCE_FIELD_TO_KEY[fieldId];
                    const value = String(entry.citation[key] ?? "");
                    return (
                      <QuestionSourceInput
                        key={field.id}
                        field={field}
                        value={value}
                        onChange={(next) => onUpdateCitationField(index, key, next)}
                        label={fieldLabel(fieldId, field.label)}
                        inputId={`qb-citation-${index}-${fieldId}`}
                      />
                    );
                  })}
                </div>
              ) : null}

              {book && citationFieldIds.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("questionBank.bookNoCitationFields")}
                </p>
              ) : null}
            </FormListFieldCard>
          );
        })}
      </FormCollectionShell>
    </section>
  );
}
