import { documentTemplateSchema, type DocumentTemplate } from "@mms/shared";
import { readObjectLocal, saveObject } from "@/lib/db";

export interface DocumentTemplateStore<TPayload> {
  readonly key: string;
  readonly changedEvent: string;
  /** Returns the persisted template, or `fallback` when missing or structurally invalid. */
  load: (fallback: DocumentTemplate<TPayload>) => DocumentTemplate<TPayload>;
  /** Validates, persists, and broadcasts `changedEvent`. Throws `TypeError` on an invalid template. */
  save: (template: DocumentTemplate<TPayload>) => DocumentTemplate<TPayload>;
}

export interface DocumentTemplateStoreOptions {
  key: string;
  changedEvent: string;
  /** Human-readable document name used in validation errors, e.g. "invoice". */
  documentName: string;
}

function isDocumentTemplate<TPayload>(value: unknown): value is DocumentTemplate<TPayload> {
  return documentTemplateSchema.safeParse(value).success;
}

export function createDocumentTemplateStore<TPayload>({
  key,
  changedEvent,
  documentName,
}: DocumentTemplateStoreOptions): DocumentTemplateStore<TPayload> {
  return {
    key,
    changedEvent,
    load(fallback) {
      const saved = readObjectLocal<unknown>(key);
      return isDocumentTemplate<TPayload>(saved) ? saved : fallback;
    },
    save(template) {
      const parsed = documentTemplateSchema.safeParse(template);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ");
        throw new TypeError(
          `Cannot save invalid ${documentName} template: missing pageSize or elements array. ${detail}`,
        );
      }
      saveObject(key, template);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(changedEvent, { detail: template }));
      }
      return template;
    },
  };
}
