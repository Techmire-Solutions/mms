/**
 * @file templateJsonIo.ts
 * @description Exporting and importing template definitions to and from JSON files.
 *
 * Import is validated against the shared `documentTemplateSchema` (the same schema the
 * server enforces) and normalised before it can reach the canvas: unknown keys are
 * rejected, element/column counts are capped, and duplicate ids are regenerated. The
 * previous hand-rolled sanitiser kept unknown keys (so the next save failed schema
 * validation) and accepted an unbounded element list from a 5 MB file.
 */

import { documentTemplateSchema, type DocumentTemplate } from "@mms/shared";
import { newId } from "./templateEditorUtils";

/** Must stay in sync with the backend request body limit for `/api/templates/:key`. */
export const MAX_TEMPLATE_FILE_BYTES = 1024 * 1024;
export const MAX_TEMPLATE_ELEMENTS = 200;
export const MAX_TABLE_COLUMNS = 50;

export type TemplateImportErrorCode = "too-large" | "invalid" | "read";

export interface TemplateImportError extends Error {
  code: TemplateImportErrorCode;
}

function importError(code: TemplateImportErrorCode, message: string): TemplateImportError {
  const error = new Error(message) as TemplateImportError;
  error.code = code;
  return error;
}

export function downloadTemplateJson<TPayload = Record<string, unknown>>(
  template: DocumentTemplate<TPayload>,
  documentType?: string,
): void {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const prefix = documentType ? `${documentType.toLowerCase()}-template` : "document-template";
  a.download = `${prefix}-${template.pageSize.toLowerCase()}.json`;
  if (
    typeof Node !== "undefined" &&
    a instanceof Node &&
    typeof document !== "undefined" &&
    document.body
  ) {
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    a.click();
  }
  // Delay revocation to prevent downloads from aborting in Safari/Firefox/Chrome
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Regenerates duplicate/blank ids so React keys and selection stay unambiguous. */
function withUniqueIds<TPayload>(template: DocumentTemplate<TPayload>): DocumentTemplate<TPayload> {
  const seen = new Set<string>();
  const normalize = (
    elements: DocumentTemplate<TPayload>["elements"] | undefined,
  ): DocumentTemplate<TPayload>["elements"] | undefined =>
    elements?.map((element) => {
      const id = element.id && !seen.has(element.id) ? element.id : newId();
      seen.add(id);
      return { ...element, id };
    });

  return {
    ...template,
    elements: normalize(template.elements) ?? [],
    ...(template.backElements ? { backElements: normalize(template.backElements) } : {}),
  };
}

function normalizeTableColumns<TPayload>(
  template: DocumentTemplate<TPayload>,
): DocumentTemplate<TPayload> {
  const clamp = (
    elements: DocumentTemplate<TPayload>["elements"] | undefined,
  ): DocumentTemplate<TPayload>["elements"] | undefined =>
    elements?.map((element) =>
      element.columns && element.columns.length > MAX_TABLE_COLUMNS
        ? { ...element, columns: element.columns.slice(0, MAX_TABLE_COLUMNS) }
        : element,
    );

  return {
    ...template,
    elements: clamp(template.elements) ?? [],
    ...(template.backElements ? { backElements: clamp(template.backElements) } : {}),
  };
}

/**
 * Parses and validates a template file.
 *
 * @throws TemplateImportError when the file is too large, cannot be read, fails the
 * shared schema, or exceeds the element ceiling.
 */
export function parseTemplateJson<TPayload = Record<string, unknown>>(
  text: string,
): DocumentTemplate<TPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw importError("invalid", "Template file is not valid JSON");
  }

  const result = documentTemplateSchema.safeParse(parsed);
  if (!result.success) {
    throw importError("invalid", result.error.issues.map((issue) => issue.message).join("; "));
  }

  const template = result.data as DocumentTemplate<TPayload>;
  const elementCount = template.elements.length + (template.backElements?.length ?? 0);
  if (elementCount > MAX_TEMPLATE_ELEMENTS) {
    throw importError(
      "invalid",
      `Template has ${elementCount} elements; the maximum is ${MAX_TEMPLATE_ELEMENTS}`,
    );
  }

  return normalizeTableColumns(withUniqueIds(template));
}

export function readTemplateJsonFile<TPayload = Record<string, unknown>>(
  file: File,
  onSuccess: (parsed: DocumentTemplate<TPayload>) => void,
  onError?: (err: TemplateImportError) => void,
): void {
  if (file.size > MAX_TEMPLATE_FILE_BYTES) {
    onError?.(
      importError(
        "too-large",
        `File exceeds the maximum allowed size of ${MAX_TEMPLATE_FILE_BYTES} bytes`,
      ),
    );
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = String(event.target?.result ?? "");
      onSuccess(parseTemplateJson<TPayload>(text));
    } catch (err) {
      onError?.(
        err instanceof Error && "code" in err
          ? (err as TemplateImportError)
          : importError("read", "Failed to read template file"),
      );
    }
  };
  reader.onerror = () => {
    onError?.(importError("read", "Failed to read template file"));
  };
  reader.readAsText(file);
}
