import { describe, expect, it } from "vitest";
import type { Distribution } from "@/lib/data/hasanatData";
import { toCreateBody } from "./hasanatMutationBodies";

const CARD: Distribution = {
  id: "dist-1",
  batchId: "bat-1",
  denominationId: "den-1",
  denominationName: "Gold",
  recipientType: "student",
  recipientStudentId: "stu-1",
  recipientName: "Ali Ahmed",
  recipientClass: "Hifz A",
  quantity: 1,
  pointsSnapshot: 50,
  reason: "Memorised Juz 5",
  issuedDate: "2026-11-10",
  issuedByUserId: "usr-1",
  status: "active",
  version: 3,
};

describe("toCreateBody", () => {
  it("forwards the per-draft idempotency key", () => {
    const body = toCreateBody({ ...CARD, clientRequestId: "hdreq-abcdef12" });
    expect(body.clientRequestId).toBe("hdreq-abcdef12");
  });

  it("omits the key when the caller has none", () => {
    const body = toCreateBody(CARD);
    expect(body).not.toHaveProperty("clientRequestId");
  });

  it("strips server-owned fields the strict create schema would reject", () => {
    const body = toCreateBody(CARD);
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("pointsSnapshot");
    expect(body.recipientName).toBe("Ali Ahmed");
  });
});
