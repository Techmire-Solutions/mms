import { describe, expect, it } from "vitest";
import { uuidv7, uuidv7Timestamp } from "./uuidv7.js";

const zeros = (bytes: Uint8Array<ArrayBuffer>) => bytes.fill(0);
const ones = (bytes: Uint8Array<ArrayBuffer>) => bytes.fill(0xff);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("given a clock, should encode it as the 48-bit timestamp prefix", () => {
    const id = uuidv7(0x017f22e279b0, zeros);
    expect(id).toBe("017f22e2-79b0-7000-8000-000000000000");
    expect(uuidv7Timestamp(id)).toBe(0x017f22e279b0);
  });

  it("given any random bytes, should set version 7 and the RFC 9562 variant", () => {
    expect(uuidv7(1_700_000_000_000, ones)).toMatch(UUID);
    expect(uuidv7(1_700_000_000_000, zeros)).toMatch(UUID);
    expect(uuidv7()).toMatch(UUID);
  });

  it("given later clocks, should sort later as strings", () => {
    const [third, first, second] = [3, 1, 2].map((offset) => uuidv7(1_700_000_000_000 + offset));
    expect([third, first, second].sort()).toEqual([first, second, third]);
  });

  it("given the default randomness, should not repeat", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uuidv7(1_700_000_000_000)));
    expect(ids.size).toBe(2000);
  });

  it("given a non-v7 id, should not report a timestamp", () => {
    expect(uuidv7Timestamp("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBeNull();
  });
});
