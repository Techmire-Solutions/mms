import { describe, expect, it } from "vitest";
import {
  buildWorkshopCertificatePayload,
  DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE,
  WORKSHOP_CERTIFICATE_FIELDS,
} from "./workshopCertificateTemplate";

const payload = buildWorkshopCertificatePayload(
  {
    contactName: "Amina Rahman",
    certificateIssuedAt: "2099-03-03T09:00:00.000Z",
    completedAt: "2099-03-02T10:00:00.000Z",
  },
  { title: "Calligraphy", startDate: "2099-03-01", endDate: "2099-03-02" },
  { heading: "Certificate", statement: "This certifies that", issuedLabel: "Issued on" },
);

describe("workshop certificate template", () => {
  it("binds every template element to a field that exists in the payload", () => {
    const keys = new Set(Object.keys(payload));
    for (const element of DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE.elements) {
      if (!element.field) continue;
      expect(keys.has(element.field), element.id).toBe(true);
    }
  });

  it("declares editor fields for every payload key", () => {
    const fieldNames = new Set(WORKSHOP_CERTIFICATE_FIELDS.map((field) => field.field));
    for (const key of Object.keys(payload)) expect(fieldNames.has(key as never), key).toBe(true);
  });

  it("builds the display payload from the completion row and workshop", () => {
    expect(payload).toMatchObject({
      recipientName: "Amina Rahman",
      courseName: "Calligraphy",
      heading: "Certificate",
    });
    expect(payload.period).toContain("2099");
    expect(payload.issuedOn).toContain("2099");
  });
});
