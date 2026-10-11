import { getPrimaryPhone, hasWhatsApp, type Faculty } from "@mms/shared";
import { computeModuleMessagingSelectionTargets } from "@/lib/messaging/computeModuleMessagingSelectionTargets";

export interface FacultySelectionTargets {
  waTargets: Faculty[];
  smsReady: Faculty[];
  emailReady: Faculty[];
}

/** Pure eligibility for bulk messaging from current-page rows ∩ selected ids. */
export function computeFacultySelectionTargets({
  selectedIds,
  workFaculty,
}: {
  selectedIds: string[];
  workFaculty?: Faculty[];
}): FacultySelectionTargets {
  const rows = workFaculty ?? [];
  return computeModuleMessagingSelectionTargets({
    selectedIds,
    rows,
    hasWhatsApp: (member) => hasWhatsApp({ phone: member.phone }),
    hasSms: (member) => Boolean(getPrimaryPhone({ phone: member.phone })),
    hasEmail: (member) => Boolean(member.email?.trim()),
  });
}
