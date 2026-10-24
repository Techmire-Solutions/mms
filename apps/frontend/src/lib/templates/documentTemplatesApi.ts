import { apiContract } from "@/lib/api";
import type { DocumentTemplate } from "@mms/shared";

/** Fetches a document template from the server by key. Returns null when not customized. */
export async function fetchDocumentTemplateServer<TPayload = Record<string, unknown>>(
  key: string,
): Promise<DocumentTemplate<TPayload> | null> {
  const res = await apiContract.templates.get({
    params: { key },
  });
  if (res.status === 200) {
    const body = res.body as { template: DocumentTemplate<TPayload> | null };
    return body.template;
  }
  return null;
}

/** Saves a document template layout to the server by key. */
export async function saveDocumentTemplateServer<TPayload = Record<string, unknown>>(
  key: string,
  template: DocumentTemplate<TPayload>,
): Promise<DocumentTemplate<TPayload>> {
  const res = await apiContract.templates.save({
    params: { key },
    body: { template },
  });
  if (res.status === 200) {
    const body = res.body as { template: DocumentTemplate<TPayload> };
    return body.template;
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
