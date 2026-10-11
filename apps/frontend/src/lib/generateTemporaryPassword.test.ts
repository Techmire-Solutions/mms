import { afterEach, describe, expect, it, vi } from "vitest";
import { generateTemporaryPassword } from "./generateTemporaryPassword";

afterEach(() => vi.restoreAllMocks());

describe("generateTemporaryPassword", () => {
  it("produces a 12-character password with required character categories", () => {
    const password = generateTemporaryPassword();
    expect(password).toHaveLength(12);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it("rejects out-of-range random bytes instead of biasing the alphabet", () => {
    const random = vi.spyOn(crypto, "getRandomValues");
    random.mockImplementationOnce((array) => {
      if (array instanceof Uint8Array) array.fill(255);
      return array;
    });
    expect(generateTemporaryPassword()).toHaveLength(12);
    expect(random.mock.calls.length).toBeGreaterThan(1);
  });
});
