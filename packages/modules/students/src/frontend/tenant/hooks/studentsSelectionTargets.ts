import { getPrimaryPhone, hasWhatsApp, type Student } from "@mms/contracts";
import { computeModuleMessagingSelectionTargets } from "@mms/fe-core/lib/computeModuleMessagingSelectionTargets";

export interface StudentsSelectionTargets {
  waTargets: Student[];
  smsReady: Student[];
  emailReady: Student[];
}

/** Pure eligibility for bulk messaging from current-page rows ∩ selected ids. */
export function computeStudentsSelectionTargets({
  selectedIds,
  workStudents,
}: {
  selectedIds: string[];
  workStudents: Student[];
}): StudentsSelectionTargets {
  return computeModuleMessagingSelectionTargets({
    selectedIds,
    rows: workStudents,
    hasWhatsApp: (student) => hasWhatsApp({ phone: student.phone }),
    hasSms: (student) => Boolean(getPrimaryPhone({ phone: student.phone })),
    hasEmail: (student) => Boolean(student.email?.trim()),
  });
}
