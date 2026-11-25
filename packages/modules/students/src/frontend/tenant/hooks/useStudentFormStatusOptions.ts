import type { TranslationFunction } from "@mms/fe-core/i18n";
import { studentStatusBadgeConfig, studentStatusLabel } from "../lib/studentStatusUi";
import type { StudentStatusSelectOption } from "../components/StudentFormSectionShared";
import { resolveStudentStatuses } from "@mms/contracts";
import { useStudentLookupMutation } from "./useStudentLookups";

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
