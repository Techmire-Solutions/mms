import type { AppTranslationKey } from "@mms/contracts";
import { useModuleCrudNotify } from "@/lib/useModuleCrudNotify";

export function useStudentsCrudNotify() {
  return useModuleCrudNotify({
    saveFailedKey: "students.saveFailed",
    bulkPartialFailureKey: "students.bulkPartialFailure",
    defaultErrorKey: "students.saveFailed",
    messageKeyForBulkFailure,
  });
}

function messageKeyForBulkFailure(singleSuccessKey: AppTranslationKey): AppTranslationKey {
  if (singleSuccessKey === "students.restoreSuccess") return "students.restoreFailed";
  if (singleSuccessKey === "students.bulkStatusSuccess") return "students.bulkStatusFailed";
  return "students.deleteFailed";
}
