import { translateValidationMessage } from "@/lib/forms/translateValidationMessage";
import { useState, useMemo, useCallback, useRef } from "react";
import {
  taskInsertSchema,
  type TaskRecord,
  type TaskInsert,
  type TaskPriority,
  type TaskStatus,
} from "@mms/contracts";
import { useTranslation } from "@/hooks/useTranslation";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { useEligibleTaskAssignees, useTasks } from "@/tenant/hooks/collections/tasks";
import type { SelectedAssignee } from "../components/TaskFormAssigneePicker";
import { buildTaskFormPayload, validateTaskDates } from "../lib/taskFormPayload";

export interface UseTaskFormControllerProps {
  open: boolean;
  onClose: () => void;
  initialData?: TaskRecord | null;
  onSave: (data: TaskInsert) => Promise<void>;
  /** Disables re-entry while a save is in flight. */
  saving?: boolean;
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
  saving = false,
}: UseTaskFormControllerProps) {
  const { t } = useTranslation();
  const inFlightRef = useRef(false);
  const [title, setTitle] = useState(() => initialData?.title ?? "");
  const [description, setDescription] = useState(() => initialData?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(() => initialData?.priority ?? "medium");
  const [status, setStatus] = useState<TaskStatus>(() => initialData?.status ?? "todo");
  const [startDate, setStartDate] = useState<string | null>(() =>
    toDateOnly(initialData?.startDate),
  );
  const [dueAt, setDueAt] = useState<string | null>(() =>
    initialData?.dueAt
      ? initialData.dueAt instanceof Date
        ? initialData.dueAt.toISOString()
        : String(initialData.dueAt)
      : null,
  );
  const [parentTaskId, setParentTaskId] = useState<string | null>(
    () => initialData?.parentTaskId ?? null,
  );
  const [selectedAssignees, setSelectedAssignees] = useState<SelectedAssignee[]>(
    () =>
      initialData?.assignees?.map((a) => ({
        facultyId: a.facultyId,
        name: a.facultyName || t("tasks.assigneeFallback"),
      })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const { data: eligibleList = [] } = useEligibleTaskAssignees({ enabled: open });
  const { data: parentCandidates } = useTasks({ limit: 100 }, { enabled: open });

  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [prevOpen, setPrevOpen] = useState(open);

  const resetForm = useCallback(
    (data: TaskRecord | null | undefined) => {
      if (data) {
        setTitle(data.title);
        setDescription(data.description ?? "");
        setPriority(data.priority);
        setStatus(data.status);
        setStartDate(toDateOnly(data.startDate));
        setDueAt(
          data.dueAt
            ? data.dueAt instanceof Date
              ? data.dueAt.toISOString()
              : String(data.dueAt)
            : null,
        );
        setParentTaskId(data.parentTaskId ?? null);
        setSelectedAssignees(
          data.assignees?.map((a) => ({
            facultyId: a.facultyId,
            name: a.facultyName || t("tasks.assigneeFallback"),
          })) ?? [],
        );
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
    },
    [t],
  );

  if (prevInitialData !== initialData || prevOpen !== open) {
    setPrevInitialData(initialData);
    setPrevOpen(open);
    resetForm(initialData);
  }

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
    if (saving || inFlightRef.current) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t("tasks.titleRequired"));
      return;
    }
    const dateError = validateTaskDates(startDate, dueAt);
    if (dateError) {
      setError(t(dateError));
      return;
    }

    const payload: TaskInsert = buildTaskFormPayload({
      title: trimmedTitle,
      description,
      priority,
      status,
      startDate,
      dueAt,
      parentTaskId,
      assignees: selectedAssignees,
      initialData,
    });

    // Same write contract the API enforces — validate only; send the *built*
    // payload so the M5 "omit unchanged assignees" behaviour survives (a re-parse
    // through `taskInsertSchema` would re-add `assignees: []`).
    const parsed = taskInsertSchema.safeParse(payload);
    if (!parsed.success) {
      setError(translateValidationMessage(parsed.error.issues[0]?.message, t));
      return;
    }

    inFlightRef.current = true;
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(mapApiFormError(err).message ?? t("tasks.saveFailed"));
    } finally {
      inFlightRef.current = false;
    }
  };

  const parentOptions = useMemo(
    () =>
      (parentCandidates?.tasks ?? [])
        .filter((task) => task.id !== initialData?.id)
        .map((task) => ({ value: task.id, label: task.title })),
    [parentCandidates, initialData],
  );

  const isDirty = useMemo(() => {
    if (!initialData) {
      return Boolean(
        title.trim() ||
        description.trim() ||
        startDate ||
        dueAt ||
        parentTaskId ||
        selectedAssignees.length > 0 ||
        priority !== "medium" ||
        status !== "todo",
      );
    }

    const normalizeDueTimestamp = (val: string | Date | null | undefined): number | null => {
      if (!val) return null;
      const ms = new Date(val).getTime();
      return Number.isNaN(ms) ? null : ms;
    };
    const initialDueMs = normalizeDueTimestamp(initialData.dueAt);
    const currentDueMs = normalizeDueTimestamp(dueAt);
    const initialAssigneeIds = (initialData.assignees ?? [])
      .map((a) => a.facultyId)
      .sort()
      .join(",");
    const currentAssigneeIds = selectedAssignees
      .map((a) => a.facultyId)
      .sort()
      .join(",");

    return (
      title.trim() !== (initialData.title ?? "").trim() ||
      description.trim() !== (initialData.description ?? "").trim() ||
      priority !== initialData.priority ||
      status !== initialData.status ||
      (startDate || null) !== toDateOnly(initialData.startDate) ||
      initialDueMs !== currentDueMs ||
      (parentTaskId || null) !== (initialData.parentTaskId || null) ||
      initialAssigneeIds !== currentAssigneeIds
    );
  }, [
    initialData,
    title,
    description,
    priority,
    status,
    startDate,
    dueAt,
    parentTaskId,
    selectedAssignees,
  ]);

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
    isDirty,
    handleAddAssignee,
    handleRemoveAssignee,
    handleSubmit,
  };
}
