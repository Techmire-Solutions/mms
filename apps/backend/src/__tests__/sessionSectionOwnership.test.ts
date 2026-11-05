import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "../lib/httpErrors.js";
import { persistClassSectionsTx } from "../db/repositories/sessionRepositorySections.js";

describe("persistClassSectionsTx section ownership", () => {
  it("given a section id owned by another class, should refuse to re-parent it", async () => {
    // Arrange — the only row with this id belongs to a different class/session.
    const tx = {
      select: vi.fn(() => ({
        from: () => ({
          where: async () => [{ id: "sec-x", classId: "cls-other", sessionId: "ses-other" }],
        }),
      })),
    };

    // Act
    const act = () =>
      persistClassSectionsTx(
        tx as never,
        { subdomain: "demo", sessionId: "ses-1", classId: "cls-1", capacity: 10, room: "" },
        [{ id: "sec-x", name: "A", capacity: 10, room: "", status: "active" }],
      );

    // Assert
    await expect(act()).rejects.toThrow(ValidationError);
  });
});
