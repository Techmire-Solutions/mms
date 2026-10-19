import { documentTemplateSchema, type DocumentTemplate } from "@mms/shared";
import { readObjectLocal, saveObject } from "@/lib/db";
import {
  fetchDocumentTemplateServer,
  saveDocumentTemplateServer,
} from "./templates/documentTemplatesApi";

export interface DocumentTemplateStore<TPayload> {
  readonly key: string;
  readonly changedEvent: string;
  /** Returns the persisted template, or `fallback` when missing or structurally invalid. */
  load: (fallback: DocumentTemplate<TPayload>) => DocumentTemplate<TPayload>;
  /** Validates, persists locally and to the server, and broadcasts `changedEvent`. Throws `TypeError` on an invalid template. */
  save: (template: DocumentTemplate<TPayload>) => DocumentTemplate<TPayload>;
  /** Async server load with local cache warm. */
  loadServer: (fallback: DocumentTemplate<TPayload>) => Promise<DocumentTemplate<TPayload>>;
  /** Async server save with validation. */
  saveServer: (template: DocumentTemplate<TPayload>) => Promise<DocumentTemplate<TPayload>>;
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
      // Proactive background server sync
      void saveDocumentTemplateServer<TPayload>(key, template).catch((err) => {
        console.warn(`[documentTemplatePersistence] Server sync failed for "${key}":`, err);
      });
      return template;
    },
    async loadServer(fallback) {
      try {
        const serverTemplate = await fetchDocumentTemplateServer<TPayload>(key);
        if (serverTemplate && isDocumentTemplate<TPayload>(serverTemplate)) {
          saveObject(key, serverTemplate);
          return serverTemplate;
        }
      } catch (err) {
        console.warn(`[documentTemplatePersistence] Failed to fetch server template "${key}":`, err);
      }
      const saved = readObjectLocal<unknown>(key);
      return isDocumentTemplate<TPayload>(saved) ? saved : fallback;
    },
    async saveServer(template) {
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
      return await saveDocumentTemplateServer<TPayload>(key, template);
    },
  };
}
