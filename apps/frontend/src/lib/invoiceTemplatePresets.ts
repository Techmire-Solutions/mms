/**
 * Public surface for the invoice template presets. The builders live under
 * `./invoicePresets/*` (split so each module stays under the 300-line ceiling) and
 * are re-exported here so existing `@/lib/invoiceTemplatePresets` importers are
 * unchanged.
 */
export type { InvoiceTemplatePreset } from "./invoicePresets/types";
export { buildClassicPreset } from "./invoicePresets/classic";
export { buildThermalPreset } from "./invoicePresets/thermal";
export { buildFormalA5Preset } from "./invoicePresets/formalA5";
export { buildModernPreset } from "./invoicePresets/modern";
export { getAvailablePresets } from "./invoicePresets/available";
