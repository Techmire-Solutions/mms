import { useState, useEffect } from "react";
import { type TaskRecord, type TaskInsert, type TaskPriority, type TaskStatus } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useEligibleTaskAssignees, useTasks } from "@/tenant/hooks/collections/tasks";
import type { SelectedAssignee } from "../components/TaskFormAssigneePicker";

export interface UseTaskFormControllerProps {
  open: boolean;
  onClose: () => void;
  initialData?: TaskRecord | null;
  onSave: (data: TaskInsert) => Promise<void>;
}

function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const raw = value instanceof Date ? value.toISOString() : String(value);
  return raw.slice(0, 10);
}

export function useTaskFormController({
  open,
  onClose,
  initialData,
  onSave,
}: UseTaskFormControllerProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<SelectedAssignee[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: eligibleList = [] } = useEligibleTaskAssignees({ enabled: open });
  const { data: parentCandidates } = useTasks({ limit: 100 }, { enabled: open });

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description ?? "");
      setPriority(initialData.priority);
      setStatus(initialData.status);
      setStartDate(toDateOnly(initialData.startDate));
      setDueAt(
        initialData.dueAt
          ? initialData.dueAt instanceof Date
            ? initialData.dueAt.toISOString()
            : String(initialData.dueAt)
          : null,
      );
      setParentTaskId(initialData.parentTaskId ?? null);
      const current =
        initialData.assignees?.map((a) => ({
          facultyId: a.facultyId,
          name: a.facultyName || t("tasks.assigneeFallback"),
        })) ?? [];
      setSelectedAssignees(current);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStatus("todo");
      setStartDate(null);
      setDueAt(null);
      setParentTaskId(null);
      setSelectedAssignees([]);
    }
    setError(null);
  }, [initialData, open, t]);

  const handleAddAssignee = (facultyId: string) => {
    if (!facultyId) return;
    if (selectedAssignees.some((a) => a.facultyId === facultyId)) return;
    const match = eligibleList.find((item) => item.facultyId === facultyId);
    if (!match) return;
    setSelectedAssignees((prev) => [
      ...prev,
      {
        facultyId: match.facultyId,
        name: match.name,
      },
    ]);
  };

  const handleRemoveAssignee = (facultyId: string) => {
    setSelectedAssignees((prev) => prev.filter((a) => a.facultyId !== facultyId));
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t("tasks.titleRequired"));
      return;
    }

    const assignees = selectedAssignees.map((a) => ({
      facultyId: a.facultyId,
    }));

    const payload: TaskInsert = {
      title: trimmedTitle,
      description: description.trim() || undefined,
      priority,
      status,
      startDate: startDate || null,
      dueAt: dueAt || null,
      parentTaskId: parentTaskId || null,
      assignees,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tasks.saveFailed"));
    }
  };

  const parentOptions = (parentCandidates?.tasks ?? [])
    .filter((task) => task.id !== initialData?.id)
    .map((task) => ({ value: task.id, label: task.title }));

  return {
    t,
    title,
    setTitle,
    description,
    setDescription,
    priority,
    setPriority,
    status,
    setStatus,
    startDate,
    setStartDate,
    dueAt,
    setDueAt,
    parentTaskId,
    setParentTaskId,
    parentOptions,
    selectedAssignees,
    eligibleList,
    error,
    handleAddAssignee,
    handleRemoveAssignee,
    handleSubmit,
  };
}
