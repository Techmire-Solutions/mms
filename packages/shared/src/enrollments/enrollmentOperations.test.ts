import { describe, expect, it } from "vitest";
import {
  enrollmentTransferBodySchema,
  enrollmentWithdrawBodySchema,
} from "./enrollmentOperations.js";
import { enrollmentHoldsSeat } from "./enrollmentsModuleManifest.js";

describe("enrollmentHoldsSeat", () => {
  it("given a live status, should hold the seat", () => {
    // Assert
    expect(enrollmentHoldsSeat("pending")).toBe(true);
    expect(enrollmentHoldsSeat("confirmed")).toBe(true);
    expect(enrollmentHoldsSeat("completed")).toBe(true);
  });

  it("given a cancelled or withdrawn enrollment, should release the seat", () => {
    // Assert
    expect(enrollmentHoldsSeat("cancelled")).toBe(false);
    expect(enrollmentHoldsSeat("withdrawn")).toBe(false);
  });
});

describe("enrollment operation bodies", () => {
  it("given a transfer with a real date and reason, should parse with an optional section", () => {
    // Act
    const parsed = enrollmentTransferBodySchema.parse({
      classId: "c2",
      effectiveOn: "2026-03-01",
      reason: "Moved to the evening batch",
    });

    // Assert
    expect(parsed).toEqual({
      classId: "c2",
      effectiveOn: "2026-03-01",
      reason: "Moved to the evening batch",
    });
  });

  it("given an impossible date, a blank reason or extra fields, should reject the body", () => {
    // Assert
    expect(
      enrollmentWithdrawBodySchema.safeParse({ effectiveOn: "2026-02-30", reason: "Moved away" })
        .success,
    ).toBe(false);
    expect(
      enrollmentWithdrawBodySchema.safeParse({ effectiveOn: "2026-02-10", reason: "  " }).success,
    ).toBe(false);
    expect(
      enrollmentWithdrawBodySchema.safeParse({
        effectiveOn: "2026-02-10",
        reason: "Moved away",
        status: "cancelled",
      }).success,
    ).toBe(false);
  });
});
