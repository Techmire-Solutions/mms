/**
 * @file useTemplateDraftGuard.ts
 * @description Leave-guard state for a Setup tab that hosts a template editor.
 *
 * The Setup shell needs to know whether leaving the Templates sub-tab would discard
 * unsaved layout work, and "confirm discard" must actually throw the draft away. The
 * editor owns its draft, so discarding remounts it via `resetNonce` with the persisted
 * layout instead of trying to reach into its state.
 *
 * Usage:
 * ```tsx
 * const templateGuard = useTemplateDraftGuard();
 * const subTabs = useModuleSetupSubTabs({
 *   isDirty: (key) => key === "templates" && templateGuard.isDirty(),
 *   onDiscard: (key) => { if (key === "templates") templateGuard.discard(); },
 *   …
 * });
 * <FinanceTemplateEditor
 *   key={templateGuard.resetNonce}
 *   onDirtyChange={templateGuard.markDirty}
 *   onClose={() => subTabs.handleSubTabChange("preferences")}
 * />
 * ```
 */

import { useCallback, useRef, useState } from "react";

export interface TemplateDraftGuard {
  /** True while the editor reports unsaved changes. */
  isDirty: () => boolean;
  /** `onDirtyChange` callback passed to the editor. */
  markDirty: (dirty: boolean) => void;
  /** Increments when the user confirms discarding; use as the editor's `key`. */
  resetNonce: number;
  /** Confirmed discard: drop the draft and remount the editor from persisted state. */
  discard: () => void;
}

export function useTemplateDraftGuard(): TemplateDraftGuard {
  const dirtyRef = useRef(false);
  const [resetNonce, setResetNonce] = useState(0);

  const isDirty = useCallback(() => dirtyRef.current, []);

  const markDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const discard = useCallback(() => {
    dirtyRef.current = false;
    setResetNonce((nonce) => nonce + 1);
  }, []);

  return { isDirty, markDirty, resetNonce, discard };
}
