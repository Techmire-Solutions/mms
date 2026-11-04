import type { AppTranslationKey } from "@mms/shared";
import { useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { apiErrorMessage } from "@/lib/apiErrorMessage";
import { isConflictError } from "@/lib/apiContractError";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { reportClientError } from "@/lib/clientErrorReporting";
import { notify } from "@/lib/notify";
import { useModuleCrudNotify } from "@/lib/useModuleCrudNotify";

export function useFacultyCrudNotify() {
  const base = useModuleCrudNotify({
    saveFailedKey: "faculty.toast.saveFailed",
    bulkPartialFailureKey: "faculty.toast.bulkPartial",
    defaultErrorKey: "faculty.toast.saveFailed",
    messageKeyForBulkFailure,
  });
  const { t } = useTranslation();

  /**
   * A 409 is a domain/concurrency conflict, not a generic save failure: the server
   * message explains it (stale `updated_at`, blocked deletion, …), so it gets its
   * own title instead of "save failed".
   */
  const handleError = useCallback(
    (
      err: unknown,
      scope: string,
      messageKey: AppTranslationKey = "faculty.toast.saveFailed",
    ): void => {
      if (isConflictError(err)) {
        const description = getApiValidationMessage(err) ?? apiErrorMessage(err, "");
        notify.error(t("faculty.toast.conflict"), description ? { description } : undefined);
        reportClientError(err, { scope });
        return;
      }
      base.handleError(err, scope, messageKey);
    },
    [base, t],
  );

  return { ...base, handleError };
}

function messageKeyForBulkFailure(singleSuccessKey: AppTranslationKey): AppTranslationKey {
  if (singleSuccessKey === "faculty.restoreSuccess") {
    return "faculty.restoreFailed";
  }
  if (singleSuccessKey === "faculty.toast.statusUpdated") {
    return "faculty.bulkStatusFailed";
  }
  return "faculty.deleteFailed";
}
