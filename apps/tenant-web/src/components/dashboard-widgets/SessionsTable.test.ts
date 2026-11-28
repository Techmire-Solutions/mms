import { describe, expect, it } from "vitest";
import { normalizeRoomLabel } from "./SessionsTable";

describe("normalizeRoomLabel", () => {
  it("capitalizes single-letter room designators like 'Room a' to 'Room A'", () => {
    expect(normalizeRoomLabel("Room a")).toBe("Room A");
    expect(normalizeRoomLabel("room b")).toBe("Room B");
    expect(normalizeRoomLabel("  Room c  ")).toBe("Room C");
  });

  it("leaves numeric rooms and non-English labels intact", () => {
    expect(normalizeRoomLabel("Room 101")).toBe("Room 101");
    expect(normalizeRoomLabel("Main Hall")).toBe("Main Hall");
    expect(normalizeRoomLabel("کمرہ الف")).toBe("کمرہ الف");
  });
});
