import { describe, expect, it } from "vitest";
import {
  PAGE_SIZES,
  getPageDimensions,
  pageSizeKeySchema,
  templateOrientationSchema,
  isRtlText,
  elementStyleSchema,
  templateElementSchema,
  documentTemplateSchema,
  type InvoiceTemplate,
  type InvoiceReceiptPayload,
  type StandardInvoiceField,
  type InvoiceTemplateFieldKey,
  type IndexedFieldLookups,
  type LookupItem,
  type FieldLookupInfo,
} from "./invoiceTemplateTypes";

describe("invoiceTemplateTypes", () => {
  it("exports standard page sizes and dimensions helper", () => {
    expect(PAGE_SIZES.A6).toBeDefined();
    expect(PAGE_SIZES.A5).toBeDefined();
    expect(PAGE_SIZES.A4).toBeDefined();

    const portrait = getPageDimensions("A6", "portrait");
    expect(portrait.width).toBeLessThan(portrait.height);

    const landscape = getPageDimensions("A6", "landscape");
    expect(landscape.width).toBeGreaterThan(landscape.height);
  });

  it("exports schema validators and RTL text detector", () => {
    expect(pageSizeKeySchema.safeParse("A4").success).toBe(true);
    expect(pageSizeKeySchema.safeParse("INVALID").success).toBe(false);

    expect(templateOrientationSchema.safeParse("portrait").success).toBe(true);
    expect(templateOrientationSchema.safeParse("landscape").success).toBe(true);
    expect(templateOrientationSchema.safeParse("diagonal").success).toBe(false);

    expect(isRtlText("بسم الله")).toBe(true);
    expect(isRtlText("Invoice Receipt")).toBe(false);

    expect(elementStyleSchema.safeParse({ fontSize: 14, textAlign: "center" }).success).toBe(true);
  });

  it("validates template and element schemas", () => {
    const validElement = {
      id: "el-1",
      type: "heading",
      label: "Receipt Heading",
      x: 10,
      y: 10,
      w: 200,
      h: 40,
    };
    expect(templateElementSchema.safeParse(validElement).success).toBe(true);

    const validTemplate = {
      pageSize: "A6",
      orientation: "portrait",
      elements: [validElement],
    };
    expect(documentTemplateSchema.safeParse(validTemplate).success).toBe(true);
  });

  it("supports type contracts for InvoiceReceiptPayload and Lookups", () => {
    const samplePayload: InvoiceReceiptPayload = {
      receipt_no: "REC-2026-001",
      received_date: "2026-09-14",
      received_by: "Finance Admin",
      sender: "Syed Baqir",
      amount: "15000",
      amount_in_words: "Fifteen Thousand Only",
      currency: "PKR",
      obligation_type: "Khums",
      custom_note: "Custom dynamic note",
    };
    expect(samplePayload.receipt_no).toBe("REC-2026-001");
    expect(samplePayload.custom_note).toBe("Custom dynamic note");

    const sampleStandardField: StandardInvoiceField = "receipt_no";
    expect(sampleStandardField).toBe("receipt_no");

    const sampleFieldKey: InvoiceTemplateFieldKey = "amount_in_words";
    const customFieldKey: InvoiceTemplateFieldKey = "custom_donor_id";
    expect(sampleFieldKey).toBe("amount_in_words");
    expect(customFieldKey).toBe("custom_donor_id");

    const sampleTemplate: InvoiceTemplate = {
      pageSize: "A6",
      elements: [],
    };
    expect(sampleTemplate.pageSize).toBe("A6");

    const item: LookupItem = { id: "c-1", name: "Ali", phone: "+923001234567" };
    const lookups: FieldLookupInfo = { contacts: [item] };
    const indexed: IndexedFieldLookups = {
      contacts: new Map([[String(item.id), item]]),
    };
    expect(indexed.contacts?.get("c-1")?.name).toBe("Ali");
  });
});
