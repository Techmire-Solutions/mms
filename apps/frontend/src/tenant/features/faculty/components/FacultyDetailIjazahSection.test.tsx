import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FacultyMember } from "@mms/shared";
import { FacultyDetailIjazahSection } from "./FacultyDetailIjazahSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockFacultyWithIjazahs: FacultyMember = {
  id: "fac-1",
  contactId: "cnt-1",
  status: "active",
  name: "Sheikh Abdullah",
  ijazahs: [
    {
      id: "ijz-1",
      title: "Hafs 'an 'Asim",
      field: "quran",
      grantingAuthority: "Sheikh Muhammad al-Qari",
      year: 1440,
      sanadChain: "Connected chain through Sheikh al-Zayyat to the Prophet (SAW)",
    },
    {
      id: "ijz-2",
      title: "Sahih al-Bukhari",
      field: "hadith",
      grantingAuthority: "Dar al-Hadith",
      year: 1442,
    },
  ],
};

describe("FacultyDetailIjazahSection", () => {
  it("renders accredited Ijazahs with titles, disciplines, and granting authorities", () => {
    const html = renderToStaticMarkup(
      <FacultyDetailIjazahSection faculty={mockFacultyWithIjazahs} />,
    );

    expect(html).toContain("Hafs &#x27;an &#x27;Asim");
    expect(html).toContain("faculty.ijazah.discipline.quran");
    expect(html).toContain("Sheikh Muhammad al-Qari");
    expect(html).toContain("Sahih al-Bukhari");
    expect(html).toContain("faculty.ijazah.discipline.hadith");
    expect(html).toContain("Dar al-Hadith");
    expect(html).toContain("(1440)");
  });

  it("returns null when faculty has no ijazahs", () => {
    const emptyFaculty: FacultyMember = {
      id: "fac-2",
      contactId: "cnt-2",
      status: "active",
      name: "Ustadh Ali",
      ijazahs: [],
    };
    const html = renderToStaticMarkup(<FacultyDetailIjazahSection faculty={emptyFaculty} />);
    expect(html).toBe("");
  });
});
