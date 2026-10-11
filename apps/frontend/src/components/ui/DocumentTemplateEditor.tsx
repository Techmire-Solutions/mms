/**
 * @file DocumentTemplateEditor.tsx
 * @description Store-backed TemplateEditor: loads the persisted layout, validates on save, and reports the outcome.
 * Shared by every printable document (invoice receipts, accounting vouchers, …).
 */

import React, { useCallback, useMemo } from "react";
import type { DocumentTemplate } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type { DocumentTemplateStore } from "@/lib/documentTemplatePersistence";
import { TemplateEditor, type TemplateEditorProps } from "@/components/ui/TemplateEditor";

export interface DocumentTemplateEditorProps<TPayload> extends Omit<
  TemplateEditorProps<TPayload>,
  "template" | "defaultTemplate" | "onSave"
> {
  store: DocumentTemplateStore<TPayload>;
  /** Factory layout: the fallback when nothing valid is stored, and the editor's reset target. */
  defaultTemplate: DocumentTemplate<TPayload>;
  /** Toast shown after a successful save. */
  savedMessage: string;
}

export function DocumentTemplateEditor<TPayload>({
  store,
  defaultTemplate,
  savedMessage,
  ...editorProps
}: DocumentTemplateEditorProps<TPayload>): React.JSX.Element {
  const { t } = useTranslation();
  const template = useMemo(() => store.load(defaultTemplate), [store, defaultTemplate]);

  const handleSave = useCallback(
    (next: DocumentTemplate<TPayload>) => {
      try {
        store.save(next);
        notify.success(savedMessage);
      } catch (err) {
        console.error(`Failed to save template "${store.key}":`, err);
        notify.error(t("templateEditor.saveFailed"));
      }
    },
    [savedMessage, store, t],
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
