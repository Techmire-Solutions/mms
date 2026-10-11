import { useEffect, useState } from "react";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import type { QuestionBankConfig } from "@/tenant/features/question-bank/hooks/useQuestionBankConfig";
import {
  buildQuestionsListMetaFields,
  shouldShowQuestionSourceCitation,
  useQuestionBankDisplayConfig,
} from "@/tenant/features/question-bank/components/useQuestionBankDisplayConfig";

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;

export interface UseQuestionBankWorkControllerOptions {
  config: QuestionBankConfig;
  pageQuestions: Question[];
  selectedIds: string[];
  listPage: number;
  search: string;
  filterCats: string[];
  filterDiff: string[];
  showDeleted: boolean;
  canDelete: boolean;
  onClearSelection?: () => void;
  onToggleSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  onModalOpenChange?: (open: boolean) => void;
  onEditQuestionChange?: (question: Question | null) => void;
  isColumnVisible?: (key: string) => boolean;
}

export function useQuestionBankWorkController({
  config,
  pageQuestions,
  selectedIds,
  listPage,
  search,
  filterCats,
  filterDiff,
  showDeleted,
  canDelete,
  onClearSelection,
  onToggleSelectAll,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  onModalOpenChange,
  onEditQuestionChange,
  isColumnVisible,
}: UseQuestionBankWorkControllerOptions) {
  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    pageQuestions.length > 0 && pageQuestions.every((q) => selectedSet.has(q.id));
  const someVisibleSelected =
    selectedSet.size > 0 && pageQuestions.some((q) => selectedSet.has(q.id));

  const handleToggleSelectAll = (checked: boolean) => {
    onToggleSelectAll?.(
      checked,
      pageQuestions.map((q) => q.id),
    );
  };

  const [pendingTrashId, setPendingTrashId] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  useEffect(() => {
    onClearSelection?.();
  }, [listPage, search, filterCats, filterDiff, onClearSelection]);

  const { difficultyConfig, typeConfig } = useQuestionBankDisplayConfig(config);

  const setShowModal = (open: boolean): void => {
    onModalOpenChange?.(open);
    if (!open) onEditQuestionChange?.(null);
  };

  const setEditingQuestion = (question: Question | null): void => {
    onEditQuestionChange?.(question);
  };

  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;
  const showSource = columnVisible("source");
  const listMetaFields = buildQuestionsListMetaFields(config, columnVisible);
  const showSourceCitation = shouldShowQuestionSourceCitation(config, showSource);

  const openNewQuestion = (): void => {
    setEditingQuestion(null);
    setShowModal(true);
  };

  const openEditQuestion = (question: Question): void => {
    setEditingQuestion(question);
    setShowModal(true);
  };

  const confirmRowTrash = (): void => {
    if (!pendingTrashId) return;
    void onDelete?.(pendingTrashId);
    setPendingTrashId(null);
  };

  const confirmBulkTrash = (): void => {
    if (showDeleted) void onBulkRestore?.(selectedIds);
    else void onBulkDelete?.(selectedIds);
    onClearSelection?.();
    setConfirmBulkOpen(false);
  };

  const canBulkTrash = canDelete && Boolean(showDeleted ? onBulkRestore : onBulkDelete);

  return {
    allVisibleSelected,
    someVisibleSelected,
    handleToggleSelectAll,
    pendingTrashId,
    setPendingTrashId,
    confirmBulkOpen,
    setConfirmBulkOpen,
    confirmRowTrash,
    confirmBulkTrash,
    canBulkTrash,
    openNewQuestion,
    openEditQuestion,
    columnVisible,
    listMetaFields,
    showSourceCitation,
    difficultyConfig,
    typeConfig,
  };
}
