/**
 * @file templateJsonIo.ts
 * @description Exporting and importing template definitions to and from JSON files.
 */

import type { DocumentTemplate } from "@mms/shared";

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

export function readTemplateJsonFile<TPayload = Record<string, unknown>>(
  file: File,
  onSuccess: (parsed: DocumentTemplate<TPayload>) => void,
  onError?: (err: unknown) => void,
): void {
  if (file.size > 5 * 1024 * 1024) {
    onError?.(new Error("File exceeds maximum allowed size of 5MB"));
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string;
      const parsed = JSON.parse(text) as DocumentTemplate<TPayload>;
      if (parsed && typeof parsed.pageSize === "string" && Array.isArray(parsed.elements)) {
        onSuccess(parsed);
      } else {
        onError?.(new Error("Invalid template structure: missing pageSize or elements array"));
      }
    } catch (err) {
      onError?.(err);
    }
  };
  reader.onerror = (e) => {
    onError?.(e);
  };
  reader.readAsText(file);
}
