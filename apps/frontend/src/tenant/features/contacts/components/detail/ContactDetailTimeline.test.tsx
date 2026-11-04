import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactDetailTimeline } from "./ContactDetailTimeline";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("ContactDetailTimeline Component", () => {
  it("renders timeline note input and activities list", () => {
    const html = renderToStaticMarkup(
      <ContactDetailTimeline
        activities={[
          {
            id: "act-1",
            type: "note",
            content: "Called contact regarding admission",
            date: "2024-01-01T00:00:00Z",
            by: "Admin",
          },
        ]}
        canPersistContact={true}
        onAddNote={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(html).toContain("Called contact regarding admission");
    expect(html).toContain("Admin");
  });

  it("renders empty timeline state when activities are empty", () => {
    const html = renderToStaticMarkup(
      <ContactDetailTimeline
        activities={[]}
        canPersistContact={false}
        onAddNote={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(html).toContain("contacts.detail.quietTimeline");
  });
});
