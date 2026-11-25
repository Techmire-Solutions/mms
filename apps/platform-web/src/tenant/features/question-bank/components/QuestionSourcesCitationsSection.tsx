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
} from "@mms/contracts";
import { FORM_INPUT } from "@mms/ui";
import {
  Field,
  FormCollectionShell,
  FormListFieldCard,
  FormSelectWithQuickCreate,
} from "@mms/fe-core/components/FormPrimitives";
import { QuestionSourceInput } from "@/tenant/features/question-bank/components/QuestionSourceInput";
import { useStableRowList } from "@mms/fe-core/forms/useStableRowList";

type TranslateFn = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

interface QuestionSourcesCitationsSectionProps {
  sourceBooks: QuestionSourceBook[];
  citationEntries: QuestionBookCitation[];
  fieldById: Map<string, ModuleFieldDef>;
  fieldLabel: (fieldId: string, fallback?: string) => string;
  t: TranslateFn;
  canAddBook?: boolean;
  onOpenAddBook?: (citationIndex: number) => void;
  onCitationsChange: (citations: QuestionBookCitation[]) => void;
}

function serializeCitations(citations: readonly QuestionBookCitation[]): string {
  return JSON.stringify(citations);
}

export function QuestionSourcesCitationsSection({
  sourceBooks,
  citationEntries,
  fieldById,
  fieldLabel,
  t,
  canAddBook = false,
  onOpenAddBook,
  onCitationsChange,
}: QuestionSourcesCitationsSectionProps): React.JSX.Element {
  const sourceBooksById = new Map(sourceBooks.map((sourceBook) => [sourceBook.id, sourceBook]));
  const entries = citationEntries.length > 0 ? citationEntries : [{ bookId: "", citation: {} }];

  const { rows, append, removeAt, updateAt } = useStableRowList<QuestionBookCitation>({
    values: entries,
    onChange: onCitationsChange,
    createValue: () => ({ bookId: "", citation: {} }),
    serialize: serializeCitations,
  });

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
        onAdd={append}
        listKey="qb-citations"
      >
        {rows.map((row, index) => {
          const entry = row.value;
          const book = sourceBooksById.get(entry.bookId);
          const citationFieldIds = book ? getBookCitationFieldIds(book) : [];

          return (
            <FormListFieldCard
              key={row.id}
              id={`qb-citation-${row.id}`}
              index={index}
              label={t("questionBank.citationEntry", { n: index + 1 })}
              removeLabel={t("questionBank.removeCitation")}
              canRemove={rows.length > 1}
              onRemove={() => removeAt(index)}
            >
              <Field id={`qb-citation-book-${row.id}`} label={t("questionBank.selectSourceBook")}>
                <FormSelectWithQuickCreate
                  id={`qb-citation-book-${row.id}`}
                  className={FORM_INPUT}
                  value={entry.bookId}
                  onChange={(val) =>
                    updateAt(index, (current) => ({ ...current, bookId: val, citation: {} }))
                  }
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
                        onChange={(next) =>
                          updateAt(index, (current) => ({
                            ...current,
                            citation: {
                              ...current.citation,
                              [key]: next,
                            } as Partial<QuestionSourceReference>,
                          }))
                        }
                        label={fieldLabel(fieldId, field.label)}
                        inputId={`qb-citation-${row.id}-${fieldId}`}
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
