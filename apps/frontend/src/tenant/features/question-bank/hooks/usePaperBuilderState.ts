import { useEffect, useState } from "react";
import { getQuestionCategoryIds, type QuestionBankQuestion as Question } from "@mms/shared";
import {
  ALL_FILTER,
  createPaperSection,
  type DifficultyFilter,
  type PaperConfig,
  type PaperSection,
} from "@/tenant/features/question-bank/lib/paperBuilderUtils";

interface UsePaperBuilderStateInput {
  defaultDuration: number;
  defaultSectionTitle: (sectionNumber: number) => string;
  questions: Question[];
}

export function usePaperBuilderState({
  defaultDuration,
  defaultSectionTitle,
  questions,
}: UsePaperBuilderStateInput) {
  const [config, setConfig] = useState<PaperConfig>(() => ({
    name: "",
    examClass: "",
    totalMarks: 100,
    duration: defaultDuration,
    instructions: "",
  }));
  const [sections, setSections] = useState<PaperSection[]>(() => [
    createPaperSection(1, defaultSectionTitle(1)),
  ]);
  const [activeSectionId, setActiveSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>(ALL_FILTER);
  const [saved, setSaved] = useState(false);

  const questionsById = (() => new Map(questions.map((question) => [question.id, question])))();
  const selectedQuestionIds = (() => new Set(sections.flatMap((section) => section.questionIds)))();
  const selectedCount = selectedQuestionIds.size;
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];

  useEffect(() => {
    if (activeSectionId || !sections[0]) return;
    setActiveSectionId(sections[0].id);
  }, [activeSectionId, sections]);

  const filteredQuestions = (() => {
    const normalizedSearch = search.trim().toLowerCase();
    return questions.filter((question) => {
      const matchesSearch =
        !normalizedSearch || question.text.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === ALL_FILTER || getQuestionCategoryIds(question).includes(categoryFilter);
      const matchesDifficulty =
        difficultyFilter === ALL_FILTER || question.difficulty === difficultyFilter;
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  })();

  const markDirty = () => setSaved(false);

  const updateConfig = <Field extends keyof PaperConfig>(
    field: Field,
    value: PaperConfig[Field],
  ) => {
    setConfig((draftConfig) => ({ ...draftConfig, [field]: value }));
    markDirty();
  };

  const updateSection = (sectionId: string, patch: Partial<PaperSection>) => {
    setSections((currentSections) =>
      currentSections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section,
      ),
    );
    markDirty();
  };

  const addSection = () => {
    const nextSectionNumber = sections.length + 1;
    const nextSection = createPaperSection(
      nextSectionNumber,
      defaultSectionTitle(nextSectionNumber),
    );
    setSections((currentSections) => [...currentSections, nextSection]);
    setActiveSectionId(nextSection.id);
    markDirty();
  };

  const removeSection = (sectionId: string) => {
    const nextSections = sections.filter((section) => section.id !== sectionId);
    const fallbackSections =
      nextSections.length > 0 ? nextSections : [createPaperSection(1, defaultSectionTitle(1))];
    setSections(fallbackSections);
    if (activeSectionId === sectionId) setActiveSectionId(fallbackSections[0]?.id ?? "");
    markDirty();
  };

  const addQuestionToActiveSection = (questionId: string) => {
    if (!activeSection || selectedQuestionIds.has(questionId)) return;
    updateSection(activeSection.id, { questionIds: [...activeSection.questionIds, questionId] });
  };

  const removeQuestionFromSection = (sectionId: string, questionId: string) => {
    const section = sections.find((entry) => entry.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      questionIds: section.questionIds.filter((entry) => entry !== questionId),
    });
  };

  const loadPaperDraft = (draftConfig: PaperConfig, draftSections: PaperSection[]) => {
    const fallbackSections =
      draftSections.length > 0 ? draftSections : [createPaperSection(1, defaultSectionTitle(1))];
    setConfig(draftConfig);
    setSections(fallbackSections);
    setActiveSectionId(fallbackSections[0]?.id ?? "");
    setSaved(true);
    setSearch("");
    setCategoryFilter(ALL_FILTER);
    setDifficultyFilter(ALL_FILTER);
  };

  return {
    activeSection,
    activeSectionId,
    addQuestionToActiveSection,
    addSection,
    categoryFilter,
    config,
    difficultyFilter,
    filteredQuestions,
    questionsById,
    loadPaperDraft,
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
  };
}
