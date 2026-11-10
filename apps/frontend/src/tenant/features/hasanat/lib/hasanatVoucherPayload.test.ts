import { describe, expect, it } from "vitest";
import type { Denomination, Distribution } from "@/lib/data/hasanatData";
import { buildHasanatVoucherPayload } from "./hasanatVoucherPayload";

const distribution = {
  id: "dist-1",
  batchId: "batch-1",
  denominationId: "denom-1",
  denominationName: "Silver Deed (10 Pts)",
  recipientType: "student",
  recipientName: "Zaid bin Harith",
  recipientClass: "Class 2",
  quantity: 2,
  reason: "Quranic Excellence Reward",
  issuedDate: "2026-09-12",
  issuedBy: "Admin Office",
  status: "active",
} as Distribution;

const denomination = { id: "denom-1", name: "Silver Deed", points: 10 } as Denomination;

describe("buildHasanatVoucherPayload", () => {
  it("multiplies the denomination points by the issued quantity", () => {
    const payload = buildHasanatVoucherPayload({
      distribution,
      denomination,
      institution: "Madrasa Al-Huda",
    });

    expect(payload).toEqual({
      institution: "Madrasa Al-Huda",
      qrPayload: "dist-1|20 Hasanat|2026-09-12",
      receiptNo: "dist-1",
      donorName: "",
      recipientName: "Zaid bin Harith",
      denomination: "Silver Deed (10 Pts)",
      totalPoints: "20 Hasanat",
      issueDate: "2026-09-12",
      expiryDate: "",
      purpose: "Quranic Excellence Reward",
      issuedBy: "Admin Office",
    });
  });

  it("does not invent points when neither the snapshot nor the deed is available", () => {
    const payload = buildHasanatVoucherPayload({
      distribution,
      institution: "Madrasa",
    });

    // A printed voucher must never show a value the backend did not compute.
    expect(payload.totalPoints).toBe("0 Hasanat");
  });

  it("encodes a per-card QR payload so two slips never share a code", () => {
    const first = buildHasanatVoucherPayload({ distribution, institution: "Madrasa" });
    const second = buildHasanatVoucherPayload({
      distribution: { ...distribution, id: "dist-2", pointsSnapshot: 30 },
      institution: "Madrasa",
    });

    expect(first.qrPayload).toContain("dist-1");
    expect(second.qrPayload).toContain("dist-2");
    expect(first.qrPayload).not.toBe(second.qrPayload);
  });

  it("binds the default template QR element to the payload field", async () => {
    const { DEFAULT_HASANAT_TEMPLATE } = await import("./hasanatTemplateData");
    const qr = DEFAULT_HASANAT_TEMPLATE.elements.find((element) => element.type === "qrcode");
    expect(qr?.field).toBe("qrPayload");
  });
});
