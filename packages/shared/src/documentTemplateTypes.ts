/**
 * @file documentTemplateTypes.ts
 * @description SSOT types, interfaces, and strict Zod DTOs for generic document
 * templates, Typst compilation engine payloads, and Zoho Invoice sync schemas.
 *
 * Stable barrel: split into focused modules to stay under the 300-line ceiling;
 * consumers keep importing everything from this path.
 */
export * from "./documentTemplateCoreTypes.js";
export * from "./typstDocumentPayloadTypes.js";
export * from "./zohoInvoiceTypes.js";
