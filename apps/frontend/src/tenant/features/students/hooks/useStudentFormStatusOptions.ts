import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { studentStatusBadgeConfig, studentStatusLabel } from "@/lib/students/studentStatusUi";
import type { StudentStatusSelectOption } from "@/tenant/features/students/components/StudentFormSectionShared";
import { resolveStudentStatuses } from "@mms/shared";
import { useStudentLookupMutation } from "@/tenant/features/students/hooks/useStudentLookups";

export function useStudentFormStatusOptions(
  t: TranslationFunction,
  configStatuses: readonly string[] | undefined,
  currentStatus: string | undefined,
) {
  const lookupMutation = useStudentLookupMutation();
  const statusBadgeConfig = studentStatusBadgeConfig(t);
  const resolvedStatuses = resolveStudentStatuses(configStatuses);
  const effectiveStatus = currentStatus || "active";
  const statusList =
    effectiveStatus && !resolvedStatuses.includes(effectiveStatus)
      ? [effectiveStatus, ...resolvedStatuses]
      : resolvedStatuses;
  const statusSelectOptions: StudentStatusSelectOption[] = statusList.map((status) => ({
    value: status,
    label: studentStatusLabel(t, status),
  }));

  const handleUpdateStatuses = async (nextStatuses: string[]) => {
    await lookupMutation.mutateAsync({ kind: "statuses", items: nextStatuses });
  };

  return {
    statusBadgeConfig,
    statusSelectOptions,
    handleUpdateStatuses,
  };
}
