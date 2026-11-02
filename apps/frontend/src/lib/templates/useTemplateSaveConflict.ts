/**
 * @file useTemplateSaveConflict.ts
 * @description Conflict state for a document-template editor.
 *
 * On a 409 the draft is kept and saving is blocked until the user explicitly reloads
 * the latest layout — retrying would overwrite the other admin's save. Reloading
 * refetches and bumps a nonce the editor uses as its remount key.
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  documentTemplateQueryKey,
  type DocumentTemplateRecord,
} from "@/lib/templates/useDocumentTemplates";

export interface TemplateSaveConflict {
  /** True after a conflict; the editor hides Save and shows the reload banner. */
  blocked: boolean;
  /** Returns true when the error was a conflict and has been reported. */
  handleSaveError: (error: unknown) => boolean;
  /** Refetch the latest layout, unblock saving, remount and return the fresh record. */
  reload: () => Promise<DocumentTemplateRecord | undefined>;
  reloadNonce: number;
}

/**
 * Identified by name rather than `instanceof` so a mocked API module (which may not
 * export the class) cannot make the conflict path throw a different error.
 */
function isConflictError(error: unknown): boolean {
  return error instanceof Error && error.name === "DocumentTemplateConflictError";
}

export function useTemplateSaveConflict(
  templateKey: string,
  t: TranslationFunction,
): TemplateSaveConflict {
  const queryClient = useQueryClient();
  const [blocked, setBlocked] = useState(false);
  const blockedRef = useRef(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const handleSaveError = useCallback(
    (error: unknown): boolean => {
      if (!isConflictError(error)) return false;
      // Keep the side effect out of the state updater: StrictMode double-invokes
      // updaters, which used to double-toast.
      if (!blockedRef.current) {
        blockedRef.current = true;
        notify.error(t("templateEditor.saveConflict"));
        setBlocked(true);
      }
      return true;
    },
    [t],
  );

  const reload = useCallback(async (): Promise<DocumentTemplateRecord | undefined> => {
    await queryClient.refetchQueries({ queryKey: documentTemplateQueryKey(templateKey) });
    blockedRef.current = false;
    setBlocked(false);
    setReloadNonce((nonce) => nonce + 1);
    return queryClient.getQueryData<DocumentTemplateRecord>(documentTemplateQueryKey(templateKey));
  }, [queryClient, templateKey]);

  return { blocked, handleSaveError, reload, reloadNonce };
}
