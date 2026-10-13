/**
 * Basic coordinate, ID, and color normalization helpers for the template editor.
 */

export const CANVAS_ACCENT = {
  selection: "hsl(var(--primary, 199 89% 48%))",
  selectionStrong: "color-mix(in srgb, hsl(var(--primary, 201 96% 27%)) 80%, black)",
  selectionSoft: "hsl(var(--primary, 199 89% 48%) / 0.06)",
  marqueeSoft: "hsl(var(--primary, 199 89% 48%) / 0.08)",
  grid: "hsl(var(--muted-foreground, 215 20% 65%) / 0.6)",
} as const;

export const SNAP = 4;

export function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP;
}

export function newId(): string {
  return `el_${crypto.randomUUID()}`;
}

export type AlignmentType = "left" | "right" | "top" | "bottom" | "centerH" | "centerV";

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function normalizeHexColor(color?: string, fallback = "#0f172a"): string {
  if (!color || typeof color !== "string") return fallback;
  const trimmed = color.trim().toLowerCase();
  if (trimmed === "white") return "#ffffff";
  if (trimmed === "black") return "#000000";
  if (trimmed === "transparent") return "#000000";
  if (/^#[0-9a-f]{8}$/.test(trimmed)) return trimmed.slice(0, 7);
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1]!, 10)))
      .toString(16)
      .padStart(2, "0");
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2]!, 10)))
      .toString(16)
      .padStart(2, "0");
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3]!, 10)))
      .toString(16)
      .padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return fallback;
}

export function interpolateTemplateTokens(text: string, data?: Record<string, unknown>): string {
  if (!text || !data) return text;
  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
    if (key in data && data[key] != null) {
      return String(data[key]);
    }
    if (key.includes(".")) {
      const parts = key.split(".");
      let current: unknown = data;
      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          current = undefined;
          break;
        }
      }
      if (current != null) {
        return String(current);
      }
    }
    return match;
  });
}
