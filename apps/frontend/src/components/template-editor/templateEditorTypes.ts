/**
 * @file templateEditorTypes.ts
 * @description Type definitions for TemplateEditor component and its props.
 */

import type {
  DocumentTemplate,
  DocumentTemplatePreset,
  TemplateFieldDefinition,
  ZohoInvoicePayload,
} from "@mms/shared";

export interface TemplateEditorBranding {
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface TemplateEditorProps<TPayload = Record<string, unknown>> {
  title?: string;
  template?: DocumentTemplate<TPayload>;
  defaultTemplate?: DocumentTemplate<TPayload>;
  availableFields?: TemplateFieldDefinition<TPayload>[];
  presets?: DocumentTemplatePreset<TPayload>[];
  documentType?:
    | "invoice"
    | "receipt"
    | "report-card"
    | "student-card"
    | "ledger"
    | "certificate"
    | "voucher"
    | string;
  sampleData?: TPayload;
  fullscreen?: boolean;
  onSave?: (template: DocumentTemplate<TPayload>) => void | Promise<void>;
  onClose: () => void;
  onExportTypst?: (payload: TPayload) => void | Promise<void>;
  onExportZoho?: (payload: ZohoInvoicePayload) => void | Promise<void>;
  /** Overrides the built-in browser print of the editing surface. */
  onPrint?: () => void;
  /** Optional callback notifying parent whenever template state changes */
  onChange?: (template: DocumentTemplate<TPayload>) => void;
  /** Optional callback notifying parent of dirty state changes */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Optional branding overrides for logo and brand colors. */
  branding?: TemplateEditorBranding;
}
