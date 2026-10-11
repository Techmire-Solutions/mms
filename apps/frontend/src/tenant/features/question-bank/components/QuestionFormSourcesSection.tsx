import { BookOpen } from "lucide-react";
import {
  type AppTranslationKey,
  type ModuleFieldDef,
  type QuestionSourceBook,
  type QuestionSourceFieldId,
} from "@mms/shared";
import { SectionCard } from "@/components/ui/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { QuestionSourcesTab } from "@/tenant/features/question-bank/components/QuestionSourcesTab";

import type { QuestionFormDraft, UpdateQuestionDraft } from "./questionFormTypes";

interface QuestionFormSourcesSectionProps {
  questionDraft: QuestionFormDraft;
  updateDraft: UpdateQuestionDraft;
  sourceBooks: QuestionSourceBook[];
  onPersistBook: (book: QuestionSourceBook) => Promise<void> | void;
  onRemoveBook: (bookId: string) => Promise<void> | void;
}

export function QuestionFormSourcesSection({
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
          onCitationsChange={(next) => updateDraft({ sourceCitations: next })}
          onPersistBook={onPersistBook}
          onRemoveBook={onRemoveBook}
          fieldLabel={(id, fallback) => fallback ?? String(id)}
          translate={(key) => t(key as AppTranslationKey)}
        />
      </SectionCard>
    </div>
  );
}
