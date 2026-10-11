import { describe, expect, it } from "vitest";
import { generateClientEntityId } from "./clientEntityIdUtils.js";

describe("clientEntityIdUtils", () => {
  it("generates a non-empty string ID", () => {
    const id = generateClientEntityId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("prepends a custom prefix without delimiter when delimiter is omitted", () => {
    const id = generateClientEntityId("m");
    expect(id.startsWith("m")).toBe(true);
  });

  it("prepends prefix with custom delimiter", () => {
    const id = generateClientEntityId("wt", "-");
    expect(id.startsWith("wt-")).toBe(true);
  });

  it("generates unique IDs across calls", () => {
    const id1 = generateClientEntityId("test");
    const id2 = generateClientEntityId("test");
    expect(id1).not.toBe(id2);
  });
});
