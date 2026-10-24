import React, { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  createQuestionSourceBook,
  QUESTION_SOURCE_FIELD_TO_KEY,
  type AppTranslationKey,
  type ModuleFieldDef,
  type QuestionBookCitation,
  type QuestionSourceBook,
  type QuestionSourceFieldId,
  type QuestionSourceReference,
} from "@mms/shared";
import { QuestionSourceBooksSection } from "@/tenant/features/question-bank/components/QuestionSourceBooksSection";
import { QuestionSourcesCitationsSection } from "@/tenant/features/question-bank/components/QuestionSourcesCitationsSection";

type TranslateFn = (key: AppTranslationKey, params?: Record<string, string | number>) => string;

interface QuestionSourcesTabProps {
  sourceBooks: QuestionSourceBook[];
  citations: QuestionBookCitation[];
  availableFieldIds: QuestionSourceFieldId[];
  orderedSourceFields: ModuleFieldDef[];
  onCitationsChange: (citations: QuestionBookCitation[]) => void;
  /** Notifies the parent after a book is created/edited/removed (post-persistence). */
  onBooksUpdated?: () => void;
  /** Persists a created/edited source book to the tenant registry via typed REST. */
  onPersistBook?: (book: QuestionSourceBook) => Promise<void> | void;
  /** Removes a source book from the tenant registry via typed REST. */
  onRemoveBook?: (bookId: string) => Promise<void> | void;
  fieldLabel: (fieldId: string, fallback?: string) => string;
  translate?: TranslateFn;
}

export function QuestionSourcesTab({
  sourceBooks,
  citations,
  availableFieldIds,
  orderedSourceFields,
  onCitationsChange,
  onBooksUpdated,
  onPersistBook,
  onRemoveBook,
  fieldLabel,
  translate,
}: QuestionSourcesTabProps): React.JSX.Element {
  const { t: globalT } = useTranslation();
  const t = translate ?? globalT;
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [draftBook, setDraftBook] = useState<QuestionSourceBook | null>(null);
  const [pendingCitationIndex, setPendingCitationIndex] = useState<number | null>(null);

  const fieldById = (() => new Map(orderedSourceFields.map((field) => [field.id, field])))();

  const citationEntries = citations.length > 0 ? citations : [{ bookId: "", citation: {} }];

  const startNewBook = (citationIndex?: number): void => {
    setPendingCitationIndex(typeof citationIndex === "number" ? citationIndex : null);
    setEditingBookId(null);
    setDraftBook(createQuestionSourceBook("", sourceBooks));
    setShowBookForm(true);
  };

  const startEditBook = (book: QuestionSourceBook): void => {
    setEditingBookId(book.id);
    setDraftBook({ ...book, fieldIds: [...book.fieldIds], metadata: { ...book.metadata } });
    setShowBookForm(true);
  };

  const toggleBookField = (fieldId: QuestionSourceFieldId): void => {
    if (!draftBook) return;
    const has = draftBook.fieldIds.includes(fieldId);
    const nextIds = has
      ? draftBook.fieldIds.filter((sourceFieldId) => sourceFieldId !== fieldId)
      : [...draftBook.fieldIds, fieldId];
    if (!nextIds.includes("sourceBookName")) nextIds.unshift("sourceBookName");
    setDraftBook({ ...draftBook, fieldIds: nextIds });
  };

  const updBookMeta = (fieldId: QuestionSourceFieldId, value: string): void => {
    if (!draftBook) return;
    const key = QUESTION_SOURCE_FIELD_TO_KEY[fieldId];
    setDraftBook({
      ...draftBook,
      name: fieldId === "sourceBookName" ? value || draftBook.name : draftBook.name,
      metadata: { ...draftBook.metadata, [key]: value },
    });
  };

  const saveBook = async (): Promise<void> => {
    if (!draftBook?.name.trim()) return;
    const payload: QuestionSourceBook = {
      ...draftBook,
      name: draftBook.metadata.bookName?.trim() || draftBook.name.trim(),
      metadata: {
        ...draftBook.metadata,
        bookName: draftBook.metadata.bookName?.trim() || draftBook.name.trim(),
      },
    };
    if (onPersistBook) {
      await onPersistBook(payload);
    }
    if (pendingCitationIndex !== null && !editingBookId) {
      updCitation(pendingCitationIndex, { bookId: payload.id, citation: {} });
    }
    onBooksUpdated?.();
    setShowBookForm(false);
    setDraftBook(null);
    setEditingBookId(null);
    setPendingCitationIndex(null);
  };

  const deleteBook = async (bookId: string): Promise<void> => {
    if (onRemoveBook) {
      await onRemoveBook(bookId);
    }
    onBooksUpdated?.();
    onCitationsChange(citations.filter((entry) => entry.bookId !== bookId));
  };

  const updCitation = (index: number, patch: Partial<QuestionBookCitation>): void => {
    const updatedCitations = citationEntries.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, ...patch } : entry,
    );
    onCitationsChange(updatedCitations.filter((entry) => entry.bookId));
  };

  const updCitationField = (
    index: number,
    key: keyof QuestionSourceReference,
    value: string,
  ): void => {
    const entry = citationEntries[index];
    updCitation(index, {
      citation: { ...entry.citation, [key]: value },
    });
  };

  const addCitation = (): void => {
    onCitationsChange([
      ...citationEntries.filter((citationEntry) => citationEntry.bookId),
      { bookId: "", citation: {} },
    ]);
  };

  const removeCitation = (index: number): void => {
    const updatedCitations = citationEntries.filter((_, entryIndex) => entryIndex !== index);
    onCitationsChange(updatedCitations.filter((entry) => entry.bookId));
  };

  if (availableFieldIds.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("questionBank.sourcesDisabledHint")}</p>;
  }

  return (
    <div className="space-y-6">
      <QuestionSourceBooksSection
        sourceBooks={sourceBooks}
        availableFieldIds={availableFieldIds}
        draftBook={draftBook}
        editingBookId={editingBookId}
        showBookForm={showBookForm}
        fieldById={fieldById}
        fieldLabel={fieldLabel}
        t={t}
        onStartNew={startNewBook}
        onStartEdit={startEditBook}
        onDeleteBook={deleteBook}
        onToggleBookField={toggleBookField}
        onUpdateBookMeta={updBookMeta}
        onSaveBook={saveBook}
        onCloseBookForm={() => {
          setShowBookForm(false);
          setDraftBook(null);
          setEditingBookId(null);
          setPendingCitationIndex(null);
        }}
      />

      <QuestionSourcesCitationsSection
        sourceBooks={sourceBooks}
        citationEntries={citationEntries}
        fieldById={fieldById}
        fieldLabel={fieldLabel}
        t={t}
        canAddBook={Boolean(onPersistBook)}
        onOpenAddBook={(citationIndex) => startNewBook(citationIndex)}
        onUpdateCitation={updCitation}
        onUpdateCitationField={updCitationField}
        onAddCitation={addCitation}
        onRemoveCitation={removeCitation}
      />
    </div>
  );
}
