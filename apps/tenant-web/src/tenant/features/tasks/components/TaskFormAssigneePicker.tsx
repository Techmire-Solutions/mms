import React from "react";
import { UserCheck } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { Badge } from "@mms/ui";
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
      <Field id={pickerId} label={t("tasks.assignees")}>
        <FormSelect
          id={pickerId}
          value=""
          onChange={(facultyId) => {
            if (facultyId) onAddAssignee(facultyId);
          }}
          placeholder={t("tasks.addAssignee")}
          searchable
          options={eligibleList
            .filter((item) => !selectedAssignees.some((a) => a.facultyId === item.facultyId))
            .map((f) => ({
              value: f.facultyId,
              label: `${f.name}${f.departmentName ? ` (${f.departmentName})` : ""}${f.isSelf ? ` • ${t("tasks.assigneeSelf")}` : ""}`,
            }))}
        />
      </Field>

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
