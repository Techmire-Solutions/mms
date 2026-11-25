/**
 * @file templateEditorSaveErrors.ts
 * @description Save-error signalling shared by the editor shell and its adapters.
 */

/**
 * The adapter already reported this failure (e.g. a 409 conflict with a dedicated
 * banner/toast). The editor shell must not add its generic "save failed" toast.
 */
export class SilentTemplateSaveError extends Error {
  constructor() {
    super("Template save failure already reported");
    this.name = "SilentTemplateSaveError";
  }
}
