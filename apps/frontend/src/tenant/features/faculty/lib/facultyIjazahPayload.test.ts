import { describe, expect, it } from "vitest";
import type { FacultyIjazah } from "@mms/shared";
import { sanitizeFacultyIjazahs } from "./facultyIjazahPayload";

const base: FacultyIjazah = {
  id: "ijz-1",
  title: "  Hafs  ",
  field: "quran",
  grantingAuthority: "  Sheikh  ",
  year: "  ",
  sanadChain: "  chain  ",
};

describe("sanitizeFacultyIjazahs", () => {
  it("trims values and maps blank nullable fields to undefined", () => {
    expect(sanitizeFacultyIjazahs([base])).toEqual([
      {
        id: "ijz-1",
        title: "Hafs",
        field: "quran",
        grantingAuthority: "Sheikh",
        year: undefined,
        sanadChain: "chain",
      },
    ]);
  });

  it("drops rows that were added but never filled", () => {
    expect(
      sanitizeFacultyIjazahs([
        base,
        {
          id: "ijz-2",
          title: " ",
          field: "quran",
          grantingAuthority: "",
          year: undefined,
          sanadChain: undefined,
        },
      ]),
    ).toHaveLength(1);
  });

  it("keeps a numeric year", () => {
    expect(sanitizeFacultyIjazahs([{ ...base, year: 1442 }])[0]?.year).toBe(1442);
  });
});
