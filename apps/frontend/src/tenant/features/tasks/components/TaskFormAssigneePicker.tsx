import React from "react";
import { UserCheck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { FormSelect } from "@/components/app/FormSelect";
import { Badge } from "@/components/ui/badge";
import type { EligibleAssigneeItem } from "../hooks/useTasksApi";

export interface SelectedAssignee {
  facultyId: string;
  name: string;
}

export interface TaskFormAssigneePickerProps {
  eligibleList: EligibleAssigneeItem[];
  selectedAssignees: SelectedAssignee[];
  onAddAssignee: (facultyId: string) => void;
  onRemoveAssignee: (facultyId: string) => void;
}

export function TaskFormAssigneePicker({
  eligibleList,
  selectedAssignees,
  onAddAssignee,
  onRemoveAssignee,
}: TaskFormAssigneePickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const pickerId = React.useId();

  return (
    <div>
      <label htmlFor={pickerId} className="block text-sm font-medium text-foreground mb-1">
        {t("tasks.assignees")}
      </label>
      <FormSelect
        id={pickerId}
        value=""
        onChange={(facultyId) => {
          if (facultyId) onAddAssignee(facultyId);
        }}
        placeholder={t("tasks.noAssignees")}
        searchable
        options={eligibleList
          .filter((item) => !selectedAssignees.some((a) => a.facultyId === item.facultyId))
          .map((f) => ({
            value: f.facultyId,
            label: `${f.name}${f.departmentName ? ` (${f.departmentName})` : ""}${f.isSelf ? ` • ${t("tasks.assigneeSelf")}` : ""}`,
          }))}
      />

      {selectedAssignees.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedAssignees.map((assignee) => (
            <Badge
              key={assignee.facultyId}
              as="span"
              tone="primary"
              pill
              size="sm"
              onRemove={() => onRemoveAssignee(assignee.facultyId)}
              removeAriaLabel={t("tasks.removeAssignee", { name: assignee.name })}
            >
              <UserCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{assignee.name}</span>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
