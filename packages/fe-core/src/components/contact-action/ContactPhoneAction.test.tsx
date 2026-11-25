import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactPhoneAction } from "./ContactPhoneAction";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: "ar",
    dir: "rtl",
  }),
}));

describe("ContactPhoneAction BiDi isolation", () => {
  it("isolates the dial code and number as LTR inside an RTL UI", () => {
    const html = renderToStaticMarkup(<ContactPhoneAction phone="+92 300 1234567" name="Ali" />);

    expect(html).toContain('dir="ltr"');
    expect(html).toContain("+92");
    expect(html).toContain("300 1234567");
  });
});
