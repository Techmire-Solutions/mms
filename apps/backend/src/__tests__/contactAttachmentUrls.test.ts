import { describe, expect, it } from "vitest";
import type { Contact } from "@mms/shared";
import {
  assertContactAttachmentUrls,
  isTenantAttachmentUrl,
} from "../contacts/use-cases/contactAttachmentUrls.js";

function attachment(url: string): NonNullable<Contact["attachments"]>[number] {
  return {
    id: `att-${url}`,
    name: "doc.pdf",
    type: "application/pdf",
    size: 1,
    url,
    date: "2026-01-01",
  };
}

describe("contact attachment URL whitelist (B-04)", () => {
  it("accepts only the tenant's relative attachment path", () => {
    expect(isTenantAttachmentUrl("/uploads/tenants/demo/attachments/a.pdf", "demo")).toBe(true);
    expect(isTenantAttachmentUrl("/uploads/tenants/DEMO/attachments/a.pdf", "demo")).toBe(true);
    expect(isTenantAttachmentUrl("/uploads/tenants/other/attachments/a.pdf", "demo")).toBe(false);
    expect(isTenantAttachmentUrl("/uploads/tenants/demo/exports/a.csv", "demo")).toBe(false);
    expect(isTenantAttachmentUrl("https://evil.example/a.pdf", "demo")).toBe(false);
    expect(
      isTenantAttachmentUrl("https://demo.example/uploads/tenants/demo/attachments/a.pdf", "demo"),
    ).toBe(false);
    expect(isTenantAttachmentUrl("javascript:alert(1)", "demo")).toBe(false);
    expect(isTenantAttachmentUrl("/uploads/tenants/demo/attachments/../x", "demo")).toBe(false);
    expect(isTenantAttachmentUrl("/uploads/tenants/demo/attachments/%2e%2e/x", "demo")).toBe(false);
  });

  it("rejects new external URLs but grandfathers unchanged legacy ones", () => {
    const legacy = attachment("https://legacy.example/uploads/old.pdf");
    const valid = attachment("/uploads/tenants/demo/attachments/new.pdf");

    expect(() =>
      assertContactAttachmentUrls({ attachments: [valid] } as Contact, "demo"),
    ).not.toThrow();
    expect(() => assertContactAttachmentUrls({ attachments: [legacy] } as Contact, "demo")).toThrow(
      /uploaded file/,
    );
    expect(() =>
      assertContactAttachmentUrls({ attachments: [legacy] } as Contact, "demo", [legacy.url]),
    ).not.toThrow();
  });
});
