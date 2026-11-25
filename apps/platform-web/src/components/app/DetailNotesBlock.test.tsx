import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailNotesBlock } from "@mms/ui/app/DetailNotesBlock";

describe("DetailNotesBlock", () => {
  it("renders the section title once and the notes body", () => {
    const html = renderToStaticMarkup(
      <DetailNotesBlock title="Notes" notes="Remember class schedule." />,
    );
    expect(html).toContain("Notes");
    expect(html).toContain("Remember class schedule.");
    expect(html).toContain('dir="auto"');
    expect(html.split("Notes").length - 1).toBe(1);
  });
});
