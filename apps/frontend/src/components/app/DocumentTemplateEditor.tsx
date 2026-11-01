/**
 * @file DocumentTemplateEditor.tsx
 * @description Server-backed adapter for the shared TemplateEditor.
 *
 * One adapter for every printable document (invoice receipts, vouchers, report cards,
 * …): it owns the `/api/templates/:key` read and save so module wrappers never touch
 * persistence directly. The core editor owns the failure toast, so a rejected save is
 * reported exactly once and the document stays dirty.
 */

import React, { useCallback } from "react";
import type { DocumentTemplate } from "@mms/shared";
import { notify } from "@/lib/notify";
import { useDocumentTemplate, useSaveDocumentTemplate } from "@/lib/templates/useDocumentTemplates";
import { TemplateEditor, type TemplateEditorProps } from "@/components/app/TemplateEditor";

export interface DocumentTemplateEditorProps<TPayload> extends Omit<
  TemplateEditorProps<TPayload>,
  "template" | "defaultTemplate" | "onSave"
> {
  /** Stable document-template key, e.g. `mms_finance_invoice_template`. */
  templateKey: string;
  /** Factory layout: the fallback when nothing valid is stored, and the editor's reset target. */
  defaultTemplate: DocumentTemplate<TPayload>;
  /** Toast shown after a successful save. */
  savedMessage: string;
}

export function DocumentTemplateEditor<TPayload>({
  templateKey,
  defaultTemplate,
  savedMessage,
  ...editorProps
}: DocumentTemplateEditorProps<TPayload>): React.JSX.Element {
  const { template } = useDocumentTemplate<TPayload>(templateKey, defaultTemplate);
  const { mutateAsync: saveTemplate } = useSaveDocumentTemplate<TPayload>(templateKey);

  const handleSave = useCallback(
    async (next: DocumentTemplate<TPayload>): Promise<void> => {
      try {
        await saveTemplate(next);
      } catch (err) {
        // The editor shell reports the failure once; log the key so the server error
        // is still attributable in client error reporting.
        console.error(`[DocumentTemplateEditor] Failed to save template "${templateKey}":`, err);
        throw err;
      }
      notify.success(savedMessage);
    },
    [saveTemplate, savedMessage, templateKey],
  );

  return (
    <TemplateEditor<TPayload>
      {...editorProps}
      template={template}
      defaultTemplate={defaultTemplate}
      onSave={handleSave}
    />
  );
}

export default DocumentTemplateEditor;
