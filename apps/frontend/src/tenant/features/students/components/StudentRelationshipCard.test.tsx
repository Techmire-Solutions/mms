import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StudentRelationshipCard,
  type StudentRelationshipCardData,
} from "./StudentRelationshipCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.name) return `${key}:${params.name}`;
      if (params?.phone) return `${key}:${params.phone}`;
      return key;
    },
  }),
}));

const mockRel: StudentRelationshipCardData = {
  key: "rel-1",
  contactId: "cnt-guardian-1",
  name: "Ibrahim Harith",
  gender: "male",
  relationship: "father",
  relationshipLabel: "Father",
  badgeCode: "FAT",
  badgeTone: "bg-info/10 text-info",
  phones: [{ number: "+1 555-0199", isPrimary: true, label: "Mobile" }],
  emails: [{ address: "ibrahim@example.com", isPrimary: true, label: "Personal" }],
  cnic: "42101-1234567-1",
  notes: "Primary guardian contact",
};

describe("StudentRelationshipCard Component", () => {
  it("renders relationship badge, name, phone, email, and cnic", () => {
    const html = renderToStaticMarkup(
      <StudentRelationshipCard
        relationship={mockRel}
        canMessage={true}
        onNavigateToContact={vi.fn()}
      />,
    );

    expect(html).toContain("Ibrahim Harith");
    expect(html).toContain("FAT");
    expect(html).toContain("+1 555-0199");
    expect(html).toContain("ibrahim@example.com");
    expect(html).toContain("42101-1234567-1");
    expect(html).toContain("Primary guardian contact");
  });
});
