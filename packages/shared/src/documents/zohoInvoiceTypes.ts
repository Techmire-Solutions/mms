/**
 * @file zohoInvoiceTypes.ts
 * @description Strict Zod schemas & types for the Zoho Invoice API payloads.
 */

import { z } from "zod";

export const zohoInvoiceLineItemSchema = z
  .object({
    item_id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    rate: z.union([z.number(), z.string()]),
    quantity: z.number(),
    item_total: z.union([z.number(), z.string()]).optional(),
  })
  .strict();

export type ZohoInvoiceLineItem = z.infer<typeof zohoInvoiceLineItemSchema>;

export const zohoInvoicePayloadSchema = z
  .object({
    invoice_number: z.string(),
    date: z.string(),
    due_date: z.string(),
    customer_id: z.string().optional(),
    customer_name: z.string(),
    line_items: z.array(zohoInvoiceLineItemSchema),
    total: z.union([z.number(), z.string()]),
    balance: z.union([z.number(), z.string()]),
    payment_terms: z.number().optional(),
    notes: z.string().optional(),
    terms: z.string().optional(),
    currency_code: z.string().optional(),
  })
  .strict();

export type ZohoInvoicePayload = z.infer<typeof zohoInvoicePayloadSchema>;
