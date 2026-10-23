import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FacultyIjazah } from "@mms/shared";
import { FacultyIjazahSection } from "./FacultyIjazahSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockIjazahs: FacultyIjazah[] = [
  {
    id: "ijz-1",
    title: "Shatibiyyah in Seven Qira'at",
    field: "quran",
    grantingAuthority: "Al-Azhar University",
    year: 2020,
  },
];

describe("FacultyIjazahSection", () => {
  it("renders existing ijazahs correctly", () => {
    const html = renderToStaticMarkup(
      <FacultyIjazahSection ijazahs={mockIjazahs} onChange={vi.fn()} />,
    );

    expect(html).toContain("Shatibiyyah in Seven Qira&#x27;at");
    expect(html).toContain("faculty.ijazah.discipline.quran");
    expect(html).toContain("Al-Azhar University");
    expect(html).toContain("(2020)");
  });

  it("renders empty state message when ijazahs list is empty", () => {
    const html = renderToStaticMarkup(
      <FacultyIjazahSection ijazahs={[]} onChange={vi.fn()} />,
    );

    expect(html).toContain("faculty.ijazah.noIjazahs");
    expect(html).toContain("faculty.ijazah.add");
  });
});
