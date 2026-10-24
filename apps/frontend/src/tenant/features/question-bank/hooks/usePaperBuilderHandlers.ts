import type { RefObject } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import { type QuestionBankQuestion as Question, type QuestionBankTest } from "@mms/shared";
import {
  ALL_FILTER,
  createPaperDraftFromTest,
  getPaperQuestionIds,
  normalizePaperSections,
  openPaperPrintWindow,
  type PaperConfig,
  type PaperSection,
} from "@/tenant/features/question-bank/lib/paperBuilderUtils";

interface UsePaperBuilderHandlersOptions {
  questions: Question[];
  tests: QuestionBankTest[];
  activePaperId: string | null;
  setActivePaperId: (id: string | null) => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  setSaved: (saved: boolean) => void;
  onSaveTest: (test: QuestionBankTest) => Promise<void>;
  printRef: RefObject<HTMLDivElement | null>;
  config: PaperConfig;
  sections: PaperSection[];
  loadPaperDraft: (config: PaperConfig, sections: PaperSection[]) => void;
}

export function usePaperBuilderHandlers({
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
}: UsePaperBuilderHandlersOptions) {
  const { t } = useTranslation();
  const qbConfig = useQuestionBankConfig(questions);

  const categoryById = (() =>
    new Map(
      qbConfig.categories.map((category) => [
        category.id,
        { color: category.color, name: category.name },
      ]),
    ))();

  const categoryOptions = (() => [
    { value: ALL_FILTER, label: t("questionBank.allCategories") },
    ...qbConfig.categories.map((category) => ({ value: category.id, label: category.name })),
  ])();

  const difficultyOptions = (() => [
    { value: ALL_FILTER, label: t("questionBank.difficultyAny") },
    ...qbConfig.enabledDifficulties.map((difficulty) => ({
      value: difficulty,
      label: qbConfig.difficultyLabel(difficulty),
    })),
  ])();

  const handlePrintPaper = (): void => {
    const content = printRef.current;
    if (!content) return;
    const title = config.name || t("questionBank.previewDefaultName");
    const didOpen = openPaperPrintWindow(content, title);
    if (!didOpen) notify.warning(t("questionBank.printWindowBlocked"));
  };

  const describeError = (caughtError: unknown): string | undefined =>
    caughtError instanceof Error ? caughtError.message : undefined;

  const handleSave = async () => {
    const paperSections = normalizePaperSections(sections);
    const questionIds = getPaperQuestionIds(paperSections);
    if (questionIds.length === 0 || saving) return;
    const currentPaper = activePaperId
      ? tests.find((paper) => paper.id === activePaperId)
      : undefined;
    const examClass = config.examClass.trim();
    const instructions = config.instructions.trim();
    const paperName = config.name.trim() || t("questionBank.previewDefaultName");
    const savedPaper = {
      id: activePaperId ?? `paper-${crypto.randomUUID()}`,
      name: paperName,
      categoryId: null,
      difficulty: "mixed",
      questionIds,
      duration: config.duration,
      createdAt: currentPaper?.createdAt ?? new Date().toISOString(),
      ...(examClass ? { examClass } : {}),
      classId: config.classId || null,
      totalMarks: config.totalMarks,
      ...(instructions ? { instructions } : {}),
      sections: paperSections,
    } satisfies QuestionBankTest;
    setSaving(true);
    try {
      await onSaveTest(savedPaper);
      setActivePaperId(savedPaper.id);
      setSaved(true);
      notify.success(t("questionBank.paperSaved"), {
        description: t("questionBank.testCreatedDesc"),
      });
    } catch (caughtError: unknown) {
      notify.error(t("questionBank.paperSaveFailed"), { description: describeError(caughtError) });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPaper = (paper: QuestionBankTest): void => {
    const draft = createPaperDraftFromTest(paper, (sectionNumber) =>
      t("questionBank.defaultSectionTitle", { n: sectionNumber }),
    );
    loadPaperDraft(draft.config, draft.sections);
    setActivePaperId(paper.id);
    notify.success(t("questionBank.paperLoaded"), { description: paper.name });
  };

  return {
    categoryById,
    categoryOptions,
    difficultyOptions,
    handlePrintPaper,
    handleSave,
    handleOpenPaper,
  };
}
