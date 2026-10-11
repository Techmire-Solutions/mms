import { useState } from "react";
import type { QuestionBankQuestion } from "@mms/shared";
import type { PaperBuilderTab } from "@/tenant/features/question-bank/components/PaperBuilder";

export function useQuestionBankModalState() {
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editQuestion, setEditQuestion] = useState<QuestionBankQuestion | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<QuestionBankQuestion | null>(null);
  const [paperBuilderSession, setPaperBuilderSession] = useState(0);
  const [paperBuilderOpen, setPaperBuilderOpen] = useState(false);
  const [paperBuilderTab, setPaperBuilderTab] = useState<PaperBuilderTab>("details");

  const openAddQuestion = (
    setActiveTab: (tab: string) => void,
    setActiveSubTab: (subTab: string) => void,
  ): void => {
    setActiveTab("work");
    setActiveSubTab("questions");
    setEditQuestion(null);
    setShowQuestionModal(true);
  };

  const closeQuestionModal = (): void => {
    setShowQuestionModal(false);
    setEditQuestion(null);
  };

  const openCreatePaper = (
    setActiveTab: (tab: string) => void,
    setActiveSubTab: (subTab: string) => void,
  ): void => {
    setActiveTab("work");
    setActiveSubTab("generate");
    setPaperBuilderTab("details");
    setPaperBuilderSession((session) => session + 1);
    setPaperBuilderOpen(true);
  };

  return {
    showQuestionModal,
    setShowQuestionModal,
    editQuestion,
    setEditQuestion,
    activeQuestion,
    setActiveQuestion,
    paperBuilderSession,
    paperBuilderOpen,
    setPaperBuilderOpen,
    paperBuilderTab,
    setPaperBuilderTab,
    openAddQuestion,
    closeQuestionModal,
    openCreatePaper,
  };
}
