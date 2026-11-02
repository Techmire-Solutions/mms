import { apiContract } from "@/lib/api";
import type { DocumentTemplate } from "@mms/shared";

/** A stored layout plus the version token required by the next save. */
export interface DocumentTemplateRecord<TPayload = Record<string, unknown>> {
  template: DocumentTemplate<TPayload>;
  updatedAt: string | null;
}

/** A save whose `expectedUpdatedAt` no longer matches the stored row (HTTP 409). */
export class DocumentTemplateConflictError extends Error {
  constructor(message = "This template was changed by someone else. Reload it before saving.") {
    super(message);
    this.name = "DocumentTemplateConflictError";
  }
}

/** Fetches a document template from the server by key. Returns null when not customized. */
export async function fetchDocumentTemplateServer<TPayload = Record<string, unknown>>(
  key: string,
): Promise<DocumentTemplateRecord<TPayload> | null> {
  const res = await apiContract.templates.get({
    params: { key },
  });
  if (res.status === 200) {
    const body = res.body as {
      template: DocumentTemplate<TPayload> | null;
      updatedAt: string | null;
    };
    return body.template ? { template: body.template, updatedAt: body.updatedAt } : null;
  }
  return null;
}

/** Saves a document template layout, guarded by the version the client last read. */
export async function saveDocumentTemplateServer<TPayload = Record<string, unknown>>(
  key: string,
  template: DocumentTemplate<TPayload>,
  expectedUpdatedAt: string | null,
): Promise<DocumentTemplateRecord<TPayload>> {
  const res = await apiContract.templates.save({
    params: { key },
    body: { template, expectedUpdatedAt },
  });
  if (res.status === 200) {
    const body = res.body as { template: DocumentTemplate<TPayload>; updatedAt: string };
    return { template: body.template, updatedAt: body.updatedAt };
  }
  if (res.status === 409) {
    throw new DocumentTemplateConflictError();
  }
  throw new Error(`Failed to save template "${key}": status ${res.status}`);
}

/** Deletes a custom document template from the server by key (reverts to default layout). */
export async function deleteDocumentTemplateServer(key: string): Promise<boolean> {
  const res = await apiContract.templates.delete({
    params: { key },
  });
  if (res.status === 200) {
    const body = res.body as { success: boolean };
    return body.success;
  }
  return false;
}
