import { describe, expect, it } from "vitest";
import { throwOverlapConflict } from "../repository/db/sessionPersistErrors.js";
import { ConflictError } from "@mms/be-core/http/errors";

describe("throwOverlapConflict", () => {
  it("maps an exclusion violation (23P01) to a 409 ConflictError", () => {
    const exclusion = { code: "23P01", message: "conflicting key value" };
    try {
      throwOverlapConflict(exclusion);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as { statusCode?: number }).statusCode).toBe(409);
    }
  });

  it("re-throws non-exclusion errors unchanged", () => {
    const plain = new Error("boom");
    expect(() => throwOverlapConflict(plain)).toThrow(plain);
  });
});
