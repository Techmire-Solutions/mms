import type { TemplateElement } from "@mms/shared";
import { newId } from "./templateEditorUtils";

/**
 * Clones template elements, generating fresh unique IDs for reset/preset operations.
 */
export function cloneTemplateElements<TPayload = Record<string, unknown>>(
  elements: TemplateElement<keyof TPayload & string>[],
): TemplateElement<keyof TPayload & string>[] {
  return elements.map((el) => ({
    ...el,
    id: newId(),
    style: el.style ? { ...el.style } : undefined,
    columns: el.columns ? el.columns.map((col) => ({ ...col })) : undefined,
    tableConfig: el.tableConfig ? { ...el.tableConfig } : undefined,
  }));
}
