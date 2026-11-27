import { memo } from "react";
import { BookOpen } from "lucide-react";
import {
  type AppTranslationKey,
  type ModuleFieldDef,
  type QuestionSourceBook,
  type QuestionSourceFieldId,
} from "@mms/contracts";
import { SectionCard } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { QuestionSourcesTab } from "./QuestionSourcesTab";

import type { QuestionFormDraft, UpdateQuestionDraft } from "../lib/questionFormTypes";

interface QuestionFormSourcesSectionProps {
  questionDraft: QuestionFormDraft;
  updateDraft: UpdateQuestionDraft;
  sourceBooks: QuestionSourceBook[];
  onPersistBook: (book: QuestionSourceBook) => Promise<void> | void;
  onRemoveBook: (bookId: string) => Promise<void> | void;
}

function QuestionFormSourcesSectionComponent({
  questionDraft,
  updateDraft,
  sourceBooks,
  onPersistBook,
  onRemoveBook,
}: QuestionFormSourcesSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const sourceFields: ModuleFieldDef[] = [
    {
      id: "sourceSurah",
      label: t("questionBank.source.surah"),
      type: "text",
      required: false,
      enabled: true,
    },
    {
      id: "sourceAyah",
      label: t("questionBank.source.ayah"),
      type: "text",
      required: false,
      enabled: true,
    },
    {
      id: "sourceHadithNumber",
      label: t("questionBank.source.hadithNumber"),
      type: "text",
      required: false,
      enabled: true,
    },
    {
      id: "sourceBookName",
      label: t("questionBank.source.bookName"),
      type: "text",
      required: false,
      enabled: true,
    },
    {
      id: "sourcePageNumber",
      label: t("questionBank.source.pageNumber"),
      type: "text",
      required: false,
      enabled: true,
    },
  ];
  const availableFieldIds: QuestionSourceFieldId[] = [
    "sourceSurah",
    "sourceAyah",
    "sourceHadithNumber",
    "sourceBookName",
    "sourcePageNumber",
  ];

  return (
    <div className="space-y-5 text-start">
      <SectionCard
        accentColor="primary"
        icon={BookOpen}
        title={t("questionBank.formTab.sources")}
        className="shadow-sm"
      >
        <QuestionSourcesTab
          sourceBooks={sourceBooks}
          citations={questionDraft.sourceCitations}
          availableFieldIds={availableFieldIds}
          orderedSourceFields={sourceFields}
          onCitationsChange={(next: any) => updateDraft({ sourceCitations: next })}
          onPersistBook={onPersistBook}
          onRemoveBook={onRemoveBook}
          fieldLabel={(id: any, fallback: any) => fallback ?? String(id)}
          translate={(key: any) => t(key as AppTranslationKey)}
        />
      </SectionCard>
    </div>
  );
}

/** Memoized: only citation edits re-render the sources card. */
export const QuestionFormSourcesSection = memo(
  QuestionFormSourcesSectionComponent,
  (prev: any, next: any) =>
    prev.questionDraft.sourceCitations === next.questionDraft.sourceCitations &&
    prev.sourceBooks === next.sourceBooks &&
    prev.updateDraft === next.updateDraft &&
    prev.onPersistBook === next.onPersistBook &&
    prev.onRemoveBook === next.onRemoveBook,
);
