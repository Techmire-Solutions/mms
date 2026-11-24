/**
 * Declared form-surface exemptions, each with the reason a regex cannot infer.
 *
 * A form whose save is a synchronous local action has no pending state to bind; a
 * forced/password prompt has no user-authored draft worth a discard confirm. Every
 * other surface belongs to the ratchet. An empty reason is an error — a silent
 * exemption is how a baseline gets padded.
 */

/** `onSave` without a `saving` prop: only synchronous local actions. */
export const SAVING_EXEMPT = new Map([
  ["components/app/BackgroundJobsTray.tsx", "read-only job tray; onSave closes the dialog"],
  [
    "components/branding/BrandColorImportModal.tsx",
    "synchronous local palette import; no network write",
  ],
  [
    "components/branding/BrandSaveCustomPresetModal.tsx",
    "parent persists theme presets to local storage synchronously",
  ],
  [
    "tenant/features/sessions/components/SessionLockOverrideDialog.tsx",
    "resolves an in-memory lock prompt; no mutation",
  ],
  ["components/llm/LlmConfigModal.tsx", "draft edit only; the settings page owns the save"],
]);

/**
 * Write surfaces with an editable draft but no `isDirty`: forced/credential prompts
 * only, where closing the dialog *is* the cancel action and a discard confirm is noise.
 */
export const DIRTY_EXEMPT = new Map([
  [
    "tenant/features/sessions/components/SessionLockOverrideDialog.tsx",
    "forced lock prompt; closing abandons the requested action",
  ],
  [
    "tenant/features/settings/components/BackupRestoreConfirmModal.tsx",
    "password step-up prompt; closing abandons the action",
  ],
  [
    "platform/features/workspaces/components/PlatformWorkspaceResetPasswordDialog.tsx",
    "credential step-up; closing abandons the action",
  ],
]);

/** Fails fast when an exemption is added without a written reason. */
export function assertExemptionReasons(map, label) {
  for (const [file, reason] of map) {
    if (typeof reason !== "string" || reason.trim().length < 10) {
      throw new Error(`${label} exemption for ${file} needs a written reason (>=10 chars)`);
    }
  }
}
