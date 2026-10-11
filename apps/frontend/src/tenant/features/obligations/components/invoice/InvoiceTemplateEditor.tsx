/**
 * @file InvoiceTemplateEditor.tsx
 * @description Obligations invoice template editor adapter wrapping the shared SSOT TemplateEditor.
 */

import React, { useCallback, useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { DocumentTemplateEditor } from "@/components/ui/DocumentTemplateEditor";
import {
  AVAILABLE_FIELDS,
  getAvailablePresets,
  getDefaultTemplate,
  INVOICE_TEMPLATE_FIELD_KEY_PREFIX,
  invoiceTemplateDocumentStore,
  type InvoiceTemplate,
  type InvoiceReceiptPayload,
  type TemplateTranslate,
} from "@/lib/invoiceTemplateStore";
import type {
  DocumentTemplatePreset,
  Mujtahid,
  MujtahidRep,
  ObligationCollection,
  ObligationType,
} from "@mms/shared";
import {
  useMergedObligationContacts,
  useMergedObligationUsers,
} from "@/tenant/features/obligations/hooks/useObligationLookups";
import { useInvoiceTemplateSampleData } from "./useInvoiceTemplateSampleData";
import { useInvoiceTemplateExports } from "./useInvoiceTemplateExports";

export interface InvoiceTemplateEditorProps {
  onClose: () => void;
  fullscreen?: boolean;
  collection?: ObligationCollection | null;
  obligationTypes?: ObligationType[];
  reps?: MujtahidRep[];
  mujtahids?: Mujtahid[];
}

const EMPTY_OBLIGATION_TYPES: ObligationType[] = [];
const EMPTY_REPS: MujtahidRep[] = [];
const EMPTY_MUJTAHIDS: Mujtahid[] = [];

export function InvoiceTemplateEditor({
  onClose,
  fullscreen = true,
  collection = null,
  obligationTypes = EMPTY_OBLIGATION_TYPES,
  reps = EMPTY_REPS,
  mujtahids = EMPTY_MUJTAHIDS,
}: InvoiceTemplateEditorProps): React.JSX.Element {
  const { t } = useTranslation();
  const branding = useBranding();
  const { handleExportTypst, handleExportZoho } = useInvoiceTemplateExports();

  const translate = useCallback<TemplateTranslate>((key) => t(key as Parameters<typeof t>[0]), [t]);

  const contactIds = useMemo(() => {
    if (!collection) return [];
    const ids = [collection.sender_id, collection.reference_id].filter(
      (id): id is string => id != null && id !== "",
    );
    return Array.from(new Set(ids));
  }, [collection]);

  const liveContacts = useMergedObligationContacts(contactIds);

  const userIds = useMemo(() => {
    if (!collection?.received_by) return [];
    return [collection.received_by];
  }, [collection?.received_by]);

  const liveUsers = useMergedObligationUsers(userIds);

  const defaultTemplate = useMemo<InvoiceTemplate>(
    () => getDefaultTemplate(branding, translate),
    [branding, translate],
  );

  const availableFields = useMemo(
    () =>
      AVAILABLE_FIELDS.map((field) => ({
        ...field,
        label: t(`${INVOICE_TEMPLATE_FIELD_KEY_PREFIX}${field.field}` as Parameters<typeof t>[0]),
      })),
    [t],
  );

  const sampleData = useInvoiceTemplateSampleData({
    collection,
    branding,
    liveContacts,
    liveUsers,
    obligationTypes,
    mujtahids,
    reps,
  });

  const presets = useMemo<DocumentTemplatePreset<InvoiceReceiptPayload>[]>(() => {
    return getAvailablePresets(branding, translate).map((p) => ({
      key: p.key,
      label: t(p.nameKey as Parameters<typeof t>[0]),
      template: p.template,
    }));
  }, [branding, translate, t]);

  return (
    <DocumentTemplateEditor<InvoiceReceiptPayload>
      store={invoiceTemplateDocumentStore}
      savedMessage={t("obligations.templateSaved")}
      title={t("obligations.templateEditorTitle")}
      defaultTemplate={defaultTemplate}
      availableFields={availableFields}
      presets={presets}
      documentType="receipt"
      sampleData={sampleData}
      fullscreen={fullscreen}
      branding={branding}
      onClose={onClose}
      onExportTypst={handleExportTypst}
      onExportZoho={handleExportZoho}
    />
  );
}

export default InvoiceTemplateEditor;
