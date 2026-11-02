/**
 * @file DocumentTemplateEditor.tsx
 * @description Server-backed adapter for the shared TemplateEditor.
 *
 * One adapter for every printable document (invoice receipts, vouchers, report cards,
 * …): it owns the `/api/templates/:key` read and save so module wrappers never touch
 * persistence directly. Saves are optimistic-concurrency guarded: a `409` keeps the
 * draft, blocks further saves and offers an explicit reload of the latest layout.
 */

import React, { useCallback } from "react";
import type { DocumentTemplate } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { useDocumentTemplate, useSaveDocumentTemplate } from "@/lib/templates/useDocumentTemplates";
import { useTemplateSaveConflict } from "@/lib/templates/useTemplateSaveConflict";
import { SilentTemplateSaveError } from "@/components/template-editor/templateEditorSaveErrors";
import { TemplateSaveConflictBanner } from "@/components/template-editor/TemplateSaveConflictBanner";
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
  const { t } = useTranslation();
  const { template } = useDocumentTemplate<TPayload>(templateKey, defaultTemplate);
  const { mutateAsync: saveTemplate } = useSaveDocumentTemplate<TPayload>(templateKey);
  const conflict = useTemplateSaveConflict(templateKey, t);

  const handleSave = useCallback(
    async (next: DocumentTemplate<TPayload>): Promise<void> => {
      // Blocked until the user reloads: retrying with a stale version would overwrite
      // the other admin's layout.
      if (conflict.blocked) return;
      try {
        await saveTemplate(next);
      } catch (err) {
        console.error(`[DocumentTemplateEditor] Failed to save template "${templateKey}":`, err);
        if (conflict.handleSaveError(err)) throw new SilentTemplateSaveError();
        throw err;
      }
      notify.success(savedMessage);
    },
    [conflict, saveTemplate, savedMessage, templateKey],
  );

  return (
    <TemplateEditor<TPayload>
      {...editorProps}
      key={`${templateKey}-${conflict.reloadNonce}`}
      template={template}
      defaultTemplate={defaultTemplate}
      canSave={!conflict.blocked}
      topBanner={
        conflict.blocked ? (
          <TemplateSaveConflictBanner onReload={conflict.reload} t={t} />
        ) : undefined
      }
      onSave={handleSave}
    />
  );
}

export default DocumentTemplateEditor;
