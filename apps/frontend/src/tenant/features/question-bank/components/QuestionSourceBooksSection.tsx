import { BookOpen, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/FormModal";
import { SectionCard } from "@/components/ui/SectionCard";
import { FORM_LABEL } from "@/components/ui/formStyles";
import {
  QUESTION_SOURCE_FIELD_TO_KEY,
  getBookDefinitionFieldIds,
  type ModuleFieldDef,
  type QuestionSourceBook,
  type QuestionSourceFieldId,
} from "@mms/shared";
import { QuestionSourceInput } from "@/tenant/features/question-bank/components/QuestionSourceInput";

type TranslateFn = (
  key: import("@mms/shared").AppTranslationKey,
  params?: Record<string, string | number>,
) => string;

interface QuestionSourceBooksSectionProps {
  sourceBooks: QuestionSourceBook[];
  availableFieldIds: QuestionSourceFieldId[];
  draftBook: QuestionSourceBook | null;
  editingBookId: string | null;
  showBookForm: boolean;
  fieldById: Map<string, ModuleFieldDef>;
  fieldLabel: (fieldId: string, fallback?: string) => string;
  t: TranslateFn;
  onStartNew: () => void;
  onStartEdit: (book: QuestionSourceBook) => void;
  onDeleteBook: (bookId: string) => void;
  onToggleBookField: (fieldId: QuestionSourceFieldId) => void;
  onUpdateBookMeta: (fieldId: QuestionSourceFieldId, value: string) => void;
  onSaveBook: () => void;
  onCloseBookForm: () => void;
}

export function QuestionSourceBooksSection({
  sourceBooks,
  availableFieldIds,
  draftBook,
  editingBookId,
  showBookForm,
  fieldById,
  fieldLabel,
  t,
  onStartNew,
  onStartEdit,
  onDeleteBook,
  onToggleBookField,
  onUpdateBookMeta,
  onSaveBook,
  onCloseBookForm,
}: QuestionSourceBooksSectionProps) {
  return (
    <SectionCard
      title={t("questionBank.sourceBooksTitle")}
      subtitle={t("questionBank.sourceBooksHint")}
      icon={BookOpen}
      actions={
        <Button
          type="button"
          variant="outline"
          onClick={onStartNew}
          className="min-h-11 w-full rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted sm:w-auto"
        >
          {t("questionBank.addSourceBook")}
        </Button>
      }
    >
      {sourceBooks.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("questionBank.noSourceBooks")}</p>
      ) : (
        <ul className="space-y-2">
          {sourceBooks.map((book) => (
            <li
              key={book.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{book.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t("questionBank.sourceBookFieldCount", { count: book.fieldIds.length })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onStartEdit(book)}
                  className="min-h-11 rounded-lg border border-border px-2 text-xs font-semibold hover:bg-muted"
                >
                  {t("questionBank.editSourceBook")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onDeleteBook(book.id)}
                  className="rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label={t("questionBank.deleteSourceBook", { name: book.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showBookForm && draftBook && (
        <FormModal
          open
          onClose={onCloseBookForm}
          title={editingBookId ? t("questionBank.editSourceBook") : t("questionBank.addSourceBook")}
          icon={BookOpen}
          cancelLabel={t("questionBank.cancel")}
          saveLabel={t("questionBank.saveSourceBook")}
          onSave={onSaveBook}
          saveDisabled={!draftBook.metadata.bookName?.trim() && !draftBook.name.trim()}
          formId="question-source-book-form"
        >
          <form
            id="question-source-book-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (draftBook.metadata.bookName?.trim() || draftBook.name.trim()) onSaveBook();
            }}
            className="space-y-3"
          >
            <div>
              <p className={FORM_LABEL}>{t("questionBank.selectBookFields")}</p>
              <div className="flex flex-wrap gap-2">
                {availableFieldIds.map((fieldId) => {
                  const selected = draftBook.fieldIds.includes(fieldId);
                  return (
                    <Button
                      key={fieldId}
                      type="button"
                      variant="outline"
                      onClick={() => fieldId !== "sourceBookName" && onToggleBookField(fieldId)}
                      disabled={fieldId === "sourceBookName"}
                      className={`min-h-11 rounded-full border px-2.5 text-xs font-semibold ${selected ? "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {fieldLabel(fieldId)}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {getBookDefinitionFieldIds(draftBook).map((fieldId) => {
                const field = fieldById.get(fieldId);
                if (!field) return null;
                const key = QUESTION_SOURCE_FIELD_TO_KEY[fieldId];
                const value = String(draftBook.metadata[key] ?? "");
                return (
                  <QuestionSourceInput
                    key={field.id}
                    field={field}
                    value={value}
                    onChange={(next) => onUpdateBookMeta(fieldId, next)}
                    label={fieldLabel(fieldId, field.label)}
                    inputId={`qb-book-${fieldId}`}
                    required={fieldId === "sourceBookName"}
                  />
                );
              })}
            </div>
          </form>
        </FormModal>
      )}
    </SectionCard>
  );
}
