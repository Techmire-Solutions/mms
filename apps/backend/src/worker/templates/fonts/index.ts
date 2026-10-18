import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export interface FontConfig {
  family: string;
  weights: number[];
  style: "normal" | "italic";
  direction: "rtl" | "ltr" | "bidi";
  typstFontName: string;
}

export const SUPPORTED_FONTS: Record<string, FontConfig> = {
  nastaliq: {
    family: "Noto Nastaliq Urdu",
    weights: [400, 700],
    style: "normal",
    direction: "rtl",
    typstFontName: "Noto Nastaliq Urdu",
  },
  arabic: {
    family: "Readex Pro",
    weights: [300, 400, 500, 600, 700],
    style: "normal",
    direction: "rtl",
    typstFontName: "Readex Pro",
  },
  sans: {
    family: "Geist",
    weights: [300, 400, 500, 600, 700],
    style: "normal",
    direction: "ltr",
    typstFontName: "Geist",
  },
};

export function getFontDirectory(): string {
  return process.env.TYPST_FONT_DIR || join(__dirname, "assets");
}
