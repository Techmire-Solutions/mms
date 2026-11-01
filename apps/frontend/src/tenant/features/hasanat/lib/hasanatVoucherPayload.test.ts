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

  it("falls back to the quantity when the denomination is unknown", () => {
    const payload = buildHasanatVoucherPayload({
      distribution,
      institution: "Madrasa",
    });

    expect(payload.totalPoints).toBe("2 Hasanat");
  });
});
