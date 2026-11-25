import type { AppTranslationKey } from "@mms/contracts";
import { useModuleCrudNotify } from "@/lib/useModuleCrudNotify";

export function useContactsCrudNotify() {
  return useModuleCrudNotify({
    saveFailedKey: "contacts.saveFailed",
    bulkPartialFailureKey: "contacts.bulkPartialFailure",
    defaultErrorKey: "contacts.saveFailed",
    messageKeyForBulkFailure,
  });
}

function messageKeyForBulkFailure(singleSuccessKey: AppTranslationKey): AppTranslationKey {
  if (singleSuccessKey === "contacts.restoreSuccessTitle") return "contacts.restoreFailed";
  if (singleSuccessKey === "contacts.deletedTitle") return "contacts.deleteFailed";
  return "contacts.saveFailed";
}
