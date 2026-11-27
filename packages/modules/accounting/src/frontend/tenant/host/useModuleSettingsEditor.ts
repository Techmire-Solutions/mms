import { getAccountingHost, type ModuleSettingsEditorState } from "../host.js";
import type { AccountingSettings } from "@mms/contracts";

export function useModuleSettingsEditor<T = AccountingSettings>(
  options: unknown,
): ModuleSettingsEditorState<T> {
  return getAccountingHost().useModuleSettingsEditor<T>(options);
}
