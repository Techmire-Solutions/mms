import React from "react";
import {
  type TaskRecord,
  type TaskInsert,
  type TaskPriority,
  type TaskStatus,
  type AppTranslationKey,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@mms/shared";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/app/DatePicker";
import { DateTimePicker } from "@/components/app/DateTimePicker";
import { TaskFormAssigneePicker } from "./TaskFormAssigneePicker";
import { useTaskFormController } from "../hooks/useTaskFormController";

export interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: TaskRecord | null;
  onSave: (data: TaskInsert) => Promise<void>;
  saving?: boolean;
}

export function TaskFormModal({
  open,
  onClose,
  initialData,
  onSave,
  saving = false,
}: TaskFormModalProps): React.JSX.Element {
  const {
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
  } = useTaskFormController({ open, onClose, initialData, onSave });

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={initialData ? t("tasks.edit") : t("tasks.create")}
      error={error ?? undefined}
      saving={saving}
      isDirty={isDirty}
      onSave={handleSubmit}
    >
      <div className="space-y-4 py-2">
        <Field id="task-title" label={t("tasks.title")} required>
          <Input
            id="task-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("tasks.titlePlaceholder")}
          />
        </Field>

        <Field id="task-description" label={t("tasks.description")}>
          <Textarea
            id="task-description"
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("tasks.descriptionPlaceholder")}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="task-priority" label={t("tasks.priority")}>
            <FormSelect
              id="task-priority"
              name="priority"
              value={priority}
              onChange={(v) => setPriority(v as TaskPriority)}
              options={TASK_PRIORITIES.map((p) => ({
                value: p,
                label: t(`tasks.priority.${p}` as AppTranslationKey),
              }))}
            />
          </Field>

          <Field id="task-status" label={t("tasks.status")}>
            <FormSelect
              id="task-status"
              name="status"
              value={status}
              onChange={(v) => setStatus(v as TaskStatus)}
              options={TASK_STATUSES.map((s) => ({
                value: s,
                label: t(`tasks.status.${s}` as AppTranslationKey),
              }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="task-start-date" label={t("tasks.startDate")}>
            <DatePicker
              id="task-start-date"
              name="startDate"
              value={startDate}
              onChange={(v) => setStartDate(v || null)}
            />
          </Field>

          <Field id="task-due-at" label={t("tasks.dueAt")}>
            <DateTimePicker
              id="task-due-at"
              name="dueAt"
              value={dueAt}
              onChange={(v) => setDueAt(v)}
            />
          </Field>
        </div>

        <Field id="task-parent" label={t("tasks.parentTask")}>
          <FormSelect
            id="task-parent"
            name="parentTaskId"
            value={parentTaskId ?? ""}
            onChange={(v) => setParentTaskId(v || null)}
            options={[{ value: "", label: t("tasks.parentTaskNone") }, ...parentOptions]}
          />
        </Field>

        <TaskFormAssigneePicker
          eligibleList={eligibleList}
          selectedAssignees={selectedAssignees}
          onAddAssignee={handleAddAssignee}
          onRemoveAssignee={handleRemoveAssignee}
        />
      </div>
    </FormModal>
  );
}
