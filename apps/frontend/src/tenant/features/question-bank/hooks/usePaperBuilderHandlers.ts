import { translateValidationMessage } from "@/lib/forms/translateValidationMessage";
import { useState, type RefObject } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useQuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import {
  questionBankTestInsertSchema,
  type QuestionBankQuestion as Question,
  type QuestionBankTest,
} from "@mms/contracts";
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
  const { t, language, dir } = useTranslation();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    const didOpen = openPaperPrintWindow(content, title, { language, direction: dir });
    if (!didOpen) notify.warning(t("questionBank.printWindowBlocked"));
  };

  const describeError = (caughtError: unknown): string | undefined =>
    caughtError instanceof Error ? caughtError.message : undefined;

  const handleSave = async () => {
    setSaveError(null);
    setFieldErrors({});
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
    // The same write contract the papers endpoint enforces. `createdAt` is a local
    // projection, not part of the insert body.
    const validation = questionBankTestInsertSchema.safeParse({
      id: savedPaper.id,
      name: savedPaper.name,
      categoryId: null,
      questionIds: savedPaper.questionIds,
      difficulty: "mixed",
      duration: savedPaper.duration,
      ...(examClass ? { examClass } : {}),
      classId: savedPaper.classId,
      ...(config.totalMarks > 0 ? { totalMarks: config.totalMarks } : {}),
      ...(instructions ? { instructions } : {}),
      sections: paperSections,
    });
    if (!validation.success) {
      const mapped: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key === "name" || key === "duration" || key === "totalMarks") {
          mapped[key] ??= issue.message;
        }
      }
      setFieldErrors(mapped);
      setSaveError(translateValidationMessage(validation.error.issues[0]?.message, t));
      return;
    }
    setSaving(true);
    try {
      await onSaveTest(savedPaper);
      setActivePaperId(savedPaper.id);
      setSaved(true);
      notify.success(t("questionBank.paperSaved"), {
        description: t("questionBank.testCreatedDesc"),
      });
    } catch (caughtError: unknown) {
      setSaveError(describeError(caughtError) ?? t("questionBank.paperSaveFailed"));
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
    saveError,
    fieldErrors,
  };
}
