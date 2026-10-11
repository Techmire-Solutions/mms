import { describe, expect, it, vi, beforeEach } from "vitest";
import { getPrintBrandingTokens, PRINT_NEUTRAL } from "@/lib/printBrandingTokens";
import { getScopedBrandingSettings } from "@/lib/settingsPreviewStore";
import { getBrandingChartPalette } from "@/lib/brandingChartPalette";

vi.mock("@/lib/settingsPreviewStore", () => ({
  getScopedBrandingSettings: vi.fn(),
}));

vi.mock("@/lib/brandingChartPalette", () => ({
  getBrandingChartPalette: vi.fn(),
}));

const mockedSettings = vi.mocked(getScopedBrandingSettings);
const mockedPalette = vi.mocked(getBrandingChartPalette);

describe("getPrintBrandingTokens", () => {
  beforeEach(() => {
    mockedSettings.mockReset();
    mockedPalette.mockReset();
  });

  it("uses provided brand colors and chart palette", () => {
    mockedSettings.mockReturnValue({ primaryColor: "#123456", secondaryColor: "#654321" } as never);
    mockedPalette.mockReturnValue({ charts: ["#ff0000"] } as never);

    const tokens = getPrintBrandingTokens();
    expect(tokens.primary).toBe("#123456");
    expect(tokens.secondary).toBe("#654321");
    expect(tokens.destructive).toBe("#ff0000");
    expect(tokens.onPrimary).toBe("#ffffff");
  });

  it("derives alpha placeholders from the primary color", () => {
    mockedSettings.mockReturnValue({ primaryColor: "#123456", secondaryColor: "#654321" } as never);
    mockedPalette.mockReturnValue({ charts: ["#ff0000"] } as never);

    const tokens = getPrintBrandingTokens();
    expect(tokens.logoPlaceholderBg).toBe("rgba(18,52,86,0.06)");
    expect(tokens.logoPlaceholderBorder).toBe("rgba(18,52,86,0.2)");
    expect(tokens.fieldPlaceholderBg).toBe("rgba(18,52,86,0.04)");
    expect(tokens.fieldPlaceholderBorder).toBe("rgba(18,52,86,0.25)");
  });

  it("spreads the neutral print palette", () => {
    mockedSettings.mockReturnValue({ primaryColor: "#123456", secondaryColor: "#654321" } as never);
    mockedPalette.mockReturnValue({ charts: ["#ff0000"] } as never);

    const tokens = getPrintBrandingTokens();
    expect(tokens.text).toBe(PRINT_NEUTRAL.text);
    expect(tokens.paper).toBe(PRINT_NEUTRAL.paper);
    expect(tokens.border).toBe(PRINT_NEUTRAL.border);
  });
});
