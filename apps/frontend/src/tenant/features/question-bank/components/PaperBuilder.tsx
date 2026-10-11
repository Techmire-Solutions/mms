import React, { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Badge } from "@/components/ui/badge";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { type QuestionBankQuestion as Question, type QuestionBankTest } from "@mms/shared";
import { usePaperBuilderState } from "@/tenant/features/question-bank/hooks/usePaperBuilderState";
import { usePaperBuilderHandlers } from "@/tenant/features/question-bank/hooks/usePaperBuilderHandlers";
import { PaperDetailsForm } from "@/tenant/features/question-bank/components/PaperDetailsForm";
import { PaperPreviewPanel } from "@/tenant/features/question-bank/components/PaperPreviewPanel";
import { PaperQuestionPicker } from "@/tenant/features/question-bank/components/PaperQuestionPicker";
import { PaperSectionsEditor } from "@/tenant/features/question-bank/components/PaperSectionsEditor";
import { SavedPapersPanel } from "@/tenant/features/question-bank/components/SavedPapersPanel";

interface PaperBuilderProps {
  questions: Question[];
  tests: QuestionBankTest[];
  activeTab?: PaperBuilderTab;
  showHeader?: boolean;
  onSaveTest: (test: QuestionBankTest) => Promise<void>;
}

export type PaperBuilderTab = "details" | "saved" | "sections" | "questions" | "preview";

/**
 * Manual paper builder for examination papers.
 */
export function PaperBuilder({
  questions,
  tests,
  activeTab,
  showHeader = true,
  onSaveTest,
}: PaperBuilderProps): React.ReactElement {
  const { t } = useTranslation();
  const qbConfig = useQuestionBankConfig(questions);
  const printRef = useRef<HTMLDivElement>(null);
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    activeSection,
    addQuestionToActiveSection,
    addSection,
    categoryFilter,
    config,
    difficultyFilter,
    filteredQuestions,
    loadPaperDraft,
    questionsById,
    removeQuestionFromSection,
    removeSection,
    saved,
    search,
    sections,
    selectedCount,
    selectedQuestionIds,
    setActiveSectionId,
    setCategoryFilter,
    setDifficultyFilter,
    setSaved,
    setSearch,
    updateConfig,
    updateSection,
  } = usePaperBuilderState({
    defaultDuration: qbConfig.defaultTestDuration,
    defaultSectionTitle: (sectionNumber) =>
      t("questionBank.defaultSectionTitle", { n: sectionNumber }),
    questions,
  });

  const {
    categoryById,
    categoryOptions,
    difficultyOptions,
    handlePrintPaper,
    handleSave,
    handleOpenPaper,
  } = usePaperBuilderHandlers({
    questions,
    tests,
    activePaperId,
    setActivePaperId,
    saving,
    setSaving,
    setSaved,
    onSaveTest,
    printRef,
    config,
    sections,
    loadPaperDraft,
  });

  return (
    <article
      className="space-y-3 sm:space-y-4"
      aria-labelledby={showHeader ? "paper-generator-title" : undefined}
    >
      {showHeader || saved ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          {showHeader && (
            <div>
              <h2 id="paper-generator-title" className="m-0 text-base font-bold text-foreground">
                {t("questionBank.generatorTitle")}
              </h2>
              <p className="m-0 text-sm text-muted-foreground">
                {t("questionBank.manualPaperGeneratorSubtitle")}
              </p>
            </div>
          )}
          {saved && (
            <Badge pill tone="success" className="gap-1.5 w-fit px-2.5 py-1 border-success/30">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("questionBank.paperSaved")}
            </Badge>
          )}
        </div>
      ) : null}

      {(!activeTab || activeTab === "details") && (
        <PaperDetailsForm config={config} onChange={updateConfig} />
      )}

      {(!activeTab || activeTab === "saved") && (
        <SavedPapersPanel
          activePaperId={activePaperId}
          papers={tests}
          onOpenPaper={handleOpenPaper}
        />
      )}

      {!activeTab && (
        <div className="grid gap-3 lg:grid-cols-paper-builder-lg xl:grid-cols-paper-builder-xl">
          <PaperSectionsEditor
            activeSectionId={activeSection?.id ?? ""}
            questionsById={questionsById}
            sections={sections}
            selectedCount={selectedCount}
            onAddSection={addSection}
            onRemoveQuestion={removeQuestionFromSection}
            onRemoveSection={removeSection}
            onSelectSection={setActiveSectionId}
            onUpdateSection={updateSection}
          />

          <PaperQuestionPicker
            activeSection={activeSection}
            categoryById={categoryById}
            categoryFilter={categoryFilter}
            categoryOptions={categoryOptions}
            difficultyFilter={difficultyFilter}
            difficultyLabel={qbConfig.difficultyLabel}
            difficultyOptions={difficultyOptions}
            questions={filteredQuestions}
            search={search}
            selectedQuestionIds={selectedQuestionIds}
            onAddQuestion={addQuestionToActiveSection}
            onCategoryFilterChange={setCategoryFilter}
            onDifficultyFilterChange={setDifficultyFilter}
            onSearchChange={setSearch}
          />
        </div>
      )}

      {activeTab === "sections" && (
        <PaperSectionsEditor
          activeSectionId={activeSection?.id ?? ""}
          questionsById={questionsById}
          sections={sections}
          selectedCount={selectedCount}
          onAddSection={addSection}
          onRemoveQuestion={removeQuestionFromSection}
          onRemoveSection={removeSection}
          onSelectSection={setActiveSectionId}
          onUpdateSection={updateSection}
        />
      )}

      {activeTab === "questions" && (
        <PaperQuestionPicker
          activeSection={activeSection}
          categoryById={categoryById}
          categoryFilter={categoryFilter}
          categoryOptions={categoryOptions}
          difficultyFilter={difficultyFilter}
          difficultyLabel={qbConfig.difficultyLabel}
          difficultyOptions={difficultyOptions}
          questions={filteredQuestions}
          search={search}
          selectedQuestionIds={selectedQuestionIds}
          onAddQuestion={addQuestionToActiveSection}
          onCategoryFilterChange={setCategoryFilter}
          onDifficultyFilterChange={setDifficultyFilter}
          onSearchChange={setSearch}
        />
      )}

      {(!activeTab || activeTab === "preview") && (
        <PaperPreviewPanel
          config={config}
          printRef={printRef}
          questionsById={questionsById}
          sections={sections}
          selectedCount={selectedCount}
          saving={saving}
          onPrint={handlePrintPaper}
          onSave={handleSave}
        />
      )}
    </article>
  );
}
