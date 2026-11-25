import { describe, expect, it } from "vitest";
import { examinationClassOptions } from "./examinationClassOptions";

const sessions = [
  {
    id: "s1",
    name: "2026 Morning",
    status: "in_progress",
    classes: [{ id: "c1", name: "Hifz A" }],
  },
  {
    id: "s2",
    name: "2025 Archived",
    status: "archived",
    classes: [{ id: "c2", name: "Old Class" }],
  },
  {
    id: "s3",
    name: "2025 Completed",
    status: "completed",
    classes: [{ id: "c3", name: "Completed Class" }],
  },
  {
    id: "s4",
    name: "2025 Cancelled",
    status: "cancelled",
    classes: [{ id: "c4", name: "Cancelled Class" }],
  },
];

describe("examinationClassOptions", () => {
  it("offers only live-session classes", () => {
    expect(examinationClassOptions(sessions)).toEqual([
      { id: "c1", name: "2026 Morning - Hifz A" },
    ]);
  });

  it("tolerates a session without classes", () => {
    expect(
      examinationClassOptions([{ id: "s5", name: "Empty", status: "open", classes: null }]),
    ).toEqual([]);
  });
});
