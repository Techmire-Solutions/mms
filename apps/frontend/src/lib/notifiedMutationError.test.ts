import { describe, expect, it } from "vitest";
import { NotifiedMutationError, isNotifiedMutationError } from "@/lib/notifiedMutationError";

describe("NotifiedMutationError", () => {
  it("is an Error with the marker name", () => {
    const err = new NotifiedMutationError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("NotifiedMutationError");
    expect(err.message).toBe("boom");
  });

  it("isNotifiedMutationError returns true only for the marker type", () => {
    expect(isNotifiedMutationError(new NotifiedMutationError())).toBe(true);
    expect(isNotifiedMutationError(new Error("plain"))).toBe(false);
    expect(isNotifiedMutationError("string")).toBe(false);
    expect(isNotifiedMutationError(null)).toBe(false);
  });
});
