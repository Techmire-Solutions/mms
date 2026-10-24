import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AVAILABLE_FIELDS,
  loadTemplate,
  saveTemplate,
  resetTemplate,
  resolveField,
  indexLookups,
} from "./invoiceTemplatePersistence";
import { INVOICE_TEMPLATE_OBJECT_KEY } from "@mms/shared";
import type { InvoiceTemplate } from "./invoiceTemplateTypes";

describe("invoiceTemplatePersistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("includes sender and reference contact details in AVAILABLE_FIELDS", () => {
    const fields = AVAILABLE_FIELDS.map((f) => f.field);
    expect(fields).toContain("sender_phone");
    expect(fields).toContain("sender_email");
    expect(fields).toContain("reference_phone");
    expect(fields).toContain("reference_email");

    for (const field of AVAILABLE_FIELDS) {
      expect(field.field).toBeTruthy();
      expect(field.label).toBeTruthy();
      expect(field.category).toBeTruthy();
      expect(field.sampleValue).toBeTruthy();
    }
  });

  it("loads default template when storage is empty", () => {
    const tmpl = loadTemplate();
    expect(tmpl).toBeDefined();
    expect(Array.isArray(tmpl.elements)).toBe(true);
    expect(tmpl.pageSize).toBe("A6");
  });

  it("recovers with default template when stored value is corrupted or missing elements", () => {
    localStorage.setItem("mms_invoice_template", JSON.stringify({ corrupted: true }));
    const tmpl = loadTemplate();
    expect(tmpl).toBeDefined();
    expect(Array.isArray(tmpl.elements)).toBe(true);
  });

  it("saves and loads valid template", () => {
    const defaultTmpl = loadTemplate();
    const customTmpl: InvoiceTemplate = {
      ...defaultTmpl,
      elements: [
        {
          id: "test-el-1",
          type: "text",
          label: "Custom Header",
          x: 10,
          y: 10,
          w: 80,
          h: 20,
        },
      ],
    };

    saveTemplate(customTmpl);
    const loaded = loadTemplate();
    expect(loaded.elements.length).toBe(1);
    expect(loaded.elements[0]?.label).toBe("Custom Header");
  });

  it("throws TypeError when saving template without elements array", () => {
    expect(() => saveTemplate({} as unknown as InvoiceTemplate)).toThrow(TypeError);
    expect(() => saveTemplate(null as unknown as InvoiceTemplate)).toThrow(TypeError);
  });

  it("resets template back to default", () => {
    const customTmpl: InvoiceTemplate = {
      ...loadTemplate(),
      elements: [],
    };
    saveTemplate(customTmpl);
    expect(loadTemplate().elements.length).toBe(0);

    const restored = resetTemplate();
    expect(restored.elements.length).toBeGreaterThan(0);
    expect(loadTemplate().elements.length).toBe(restored.elements.length);
  });

  it("resolves sender and reference contact phone and email fields", () => {
    const lookups = {
      contacts: [
        { id: "c1", name: "Ali Reza", phone: "+923001234567", email: "ali@example.com" },
        { id: "c2", name: "Hassan Raza", phone: "+923007654321", email: "hassan@example.com" },
      ],
    };

    const collection = {
      sender_id: "c1",
      reference_id: "c2",
    };

    expect(resolveField("sender_phone", collection, lookups)).toBe("+923001234567");
    expect(resolveField("sender_email", collection, lookups)).toBe("ali@example.com");
    expect(resolveField("reference_phone", collection, lookups)).toBe("+923007654321");
    expect(resolveField("reference_email", collection, lookups)).toBe("hassan@example.com");
  });

  it("resolves amount_in_words dynamically", () => {
    const lookups = {
      currencies: [{ id: "cur1", code: "USD" }],
    };
    const collection = {
      amount: 1500,
      currency_id: "cur1",
    };
    expect(resolveField("amount_in_words", collection, lookups)).toBe(
      "One Thousand Five Hundred USD Only",
    );
  });

  it("sanitizes currency codes and falls back safely", () => {
    const collection = {
      amount: 2500,
      currency_id: "cur_uuid_12345",
    };
    // If currencyId is an internal ID not in lookup, falls back to PKR
    expect(resolveField("currency", collection)).toBe("PKR");
    expect(resolveField("amount", collection)).toContain("2,500");

    // If currencyId is already an ISO code
    const isoCollection = {
      amount: 2500,
      currency_id: "EUR",
    };
    expect(resolveField("currency", isoCollection)).toBe("EUR");
    expect(resolveField("amount", isoCollection)).toContain("2,500");
  });

  it("resolves branding fields from lookups.branding or collection fallback", () => {
    const lookups = {
      branding: {
        madrasaName: "Al-Huda Seminary",
        phone: "+92 21 111222333",
        email: "info@alhuda.edu",
        addressLine1: "786 Knowledge Way",
      },
    };

    expect(resolveField("institution_name", {}, lookups)).toBe("Al-Huda Seminary");
    expect(resolveField("institution_phone", {}, lookups)).toBe("+92 21 111222333");
    expect(resolveField("institution_email", {}, lookups)).toBe("info@alhuda.edu");
    expect(resolveField("institution_address", {}, lookups)).toBe("786 Knowledge Way");

    // Fallback to collection properties
    const collection = {
      institution: "Fallback Madrasa",
      institution_phone: "+92 300 0000000",
    };
    expect(resolveField("institution_name", collection)).toBe("Fallback Madrasa");
    expect(resolveField("institution_phone", collection)).toBe("+92 300 0000000");
  });

  it("resolves custom fields configured in module Setup via collection.custom_data", () => {
    const collection = {
      id: "col-1",
      custom_data: {
        check_number: "CHK-998811",
        bank_branch: "Main City Branch",
      },
    };

    expect(resolveField("check_number", collection)).toBe("CHK-998811");
    expect(resolveField("bank_branch", collection)).toBe("Main City Branch");
    expect(resolveField("non_existent_field", collection)).toBe("");
  });

  it("supports high-performance resolution using indexLookups", () => {
    const rawLookups = {
      contacts: [{ id: "c1", name: "Zaid Ali", phone: "+923001111111" }],
      currencies: [{ id: "cur1", code: "GBP" }],
    };

    const indexed = indexLookups(rawLookups);
    const collection = {
      sender_id: "c1",
      amount: 350,
      currency_id: "cur1",
    };

    expect(resolveField("sender", collection, indexed)).toBe("Zaid Ali");
    expect(resolveField("sender_phone", collection, indexed)).toBe("+923001111111");
    expect(resolveField("currency", collection, indexed)).toBe("GBP");
    expect(resolveField("amount", collection, indexed)).toContain("350");
  });

  it("gracefully returns empty string for missing lookups or fields", () => {
    expect(resolveField("sender_phone", null)).toBe("");
    expect(resolveField("sender_phone", undefined)).toBe("");
    expect(resolveField("sender_phone", { sender_id: "missing" }, {})).toBe("");
    expect(resolveField("amount", { amount: null })).toBe("");
    expect(resolveField("amount", { amount: "not-a-number" })).toBe("");
    expect(resolveField("amount_in_words", null)).toBe("");
    expect(resolveField("amount_in_words", { amount: "invalid" })).toBe("");
    expect(
      resolveField("sender", { sender_id: "   " }, { contacts: [{ id: "", name: "Empty" }] }),
    ).toBe("   ");
  });

  it("rejects invalid templates without pageSize on saveTemplate and falls back on loadTemplate", () => {
    expect(() => saveTemplate({ elements: [] } as unknown as InvoiceTemplate)).toThrow(
      "Cannot save invalid invoice template: missing pageSize or elements array.",
    );

    localStorage.setItem(INVOICE_TEMPLATE_OBJECT_KEY, JSON.stringify({ elements: [] }));
    const loaded = loadTemplate();
    expect(loaded.pageSize).toBe("A6");
    expect(loaded.elements.length).toBeGreaterThan(0);
  });

  it("resolves composite multi-part branding addresses and JSON-stringified custom_data", () => {
    const lookups = {
      branding: {
        addressLine1: "Suite 404",
        addressLine2: "Seminary Tower",
        city: "Qom",
      },
    };
    expect(resolveField("institution_address", {}, lookups)).toBe("Suite 404, Seminary Tower, Qom");

    const collectionWithJson = {
      id: "col-json",
      custom_data: JSON.stringify({
        agent_code: "AGT-007",
        tax_exempt_id: "TX-99",
      }),
    };
    expect(resolveField("agent_code", collectionWithJson)).toBe("AGT-007");
    expect(resolveField("tax_exempt_id", collectionWithJson)).toBe("TX-99");
  });
});
