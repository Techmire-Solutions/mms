import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GuardianContactCard } from "./GuardianContactCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.phone) return `${key}:${params.phone}`;
      return key;
    },
  }),
}));

describe("GuardianContactCard Component", () => {
  it("renders guardian label, badge code, name, and phone", () => {
    const html = renderToStaticMarkup(
      <GuardianContactCard
        label="Father"
        badgeCode="FAT"
        badgeTone="bg-info/10 text-info"
        name="Ibrahim Harith"
        phone="+1 555-0100"
        onWhatsApp={vi.fn()}
      />,
    );

    expect(html).toContain("Father");
    expect(html).toContain("FAT");
    expect(html).toContain("Ibrahim Harith");
    expect(html).toContain("+1 555-0100");
  });
});
