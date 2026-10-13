/**
 * MMS Print and Document Template Design Tokens — SSOT.
 *
 * All hex color literals required for physical print media (A4/Letter/A5/A6),
 * PDF generation canvases, canvas/SVG element renderers, and default certificate/voucher
 * templates are defined here and imported by template editors.
 *
 * Rule: mms-ui-ux-design.mdc §2 — interactive web UI uses semantic tokens
 * (oklch via Tailwind v4 @theme); physical print styles are quarantined here.
 *
 * @module printTemplateStyles
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core neutral palette
// ─────────────────────────────────────────────────────────────────────────────

export const PRINT_COLORS = {
  white: "#ffffff",
  black: "#111827",
  darkGray: "#374151",
  mediumGray: "#4b5563",
  lightGray: "#6b7280",
  borderGray: "#d1d5db",
  borderLight: "#e5e7eb",
  borderLighter: "#f3f4f6",
  /** Slate-200 — default canvas border in the template editor. */
  borderSlate: "#cbd5e1",
  ruleGray: "#9ca3af",
  slateDark: "#0f172a",
  slateMedium: "#334155",
  slateLight: "#64748b",
  primaryBlue: "#0369a1",
  skyDivider: "#0284c7",
  accentAmber: "#b45309",
  successGreen: "#16a34a",
  emeraldGreen: "#047857",
  dangerRed: "#dc2626",
  highlightBg: "#f0f9ff",
  metallicBronze: "#cd7f32",
  metallicSilver: "#9ca3af",
} as const;

export const PRINT_NEUTRAL_PALETTE = {
  text: "#222222",
  muted: "#888888",
  caption: "#6b7280",
  subcaption: "#9ca3af",
  body: "#4b5563",
  emphasis: "#374151",
  label: "#555555",
  labelLight: "#777777",
  border: "#e5e7eb",
  placeholder: "#cccccc",
  paper: "#ffffff",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Emerald family — Hasanat and charity module template accent colours
// ─────────────────────────────────────────────────────────────────────────────

/** Vibrant emerald used for decorative dividers and brand accents. */
export const PRINT_EMERALD = "#059669";
/** Lighter emerald highlight used for backgrounds, secondary accents. */
export const PRINT_EMERALD_LIGHT = "#10b981";
/** Deep emerald for primary headings, section titles, strong accents. */
export const PRINT_EMERALD_DEEP = "#047857";
/** Muted slate — used for secondary text in Hasanat vouchers. */
export const PRINT_SLATE_MUTED = "#64748b";

// ─────────────────────────────────────────────────────────────────────────────
// Status / semantic family — shared across Finance, Examinations, Hasanat
// ─────────────────────────────────────────────────────────────────────────────

/** Deep sky blue for receipt titles and primary document headings. */
export const PRINT_BLUE_DEEP = "#0369a1";
/** Sky blue divider line accent. */
export const PRINT_BLUE_DIVIDER = "#0284c7";
/** Danger/overdue red for balance due, receipt numbers, negative amounts. */
export const PRINT_RED_DANGER = "#dc2626";
/** Success green for paid amounts, cleared balances, passing grades. */
export const PRINT_GREEN_SUCCESS = "#16a34a";
/** Deep amber for warnings, conditional grades, secondary status lines. */
export const PRINT_AMBER_DEEP = "#b45309";

// ─────────────────────────────────────────────────────────────────────────────
// Examination / report card palette
// ─────────────────────────────────────────────────────────────────────────────

/** Dark slate for bold headers and table borders on report cards. */
export const PRINT_SLATE_DARK = "#0f172a";
/** Medium slate for subtitles, metadata rows on report cards. */
export const PRINT_SLATE_MEDIUM = "#334155";

// ─────────────────────────────────────────────────────────────────────────────
// Question paper / exam print styles
// ─────────────────────────────────────────────────────────────────────────────

/** Standard question paper section note and footer text colour. */
export const PRINT_SECTION_NOTE = "#4b5563";
/** Rule/divider line for question papers. */
export const PRINT_RULE = "#9ca3af";
/** Metadata cell border on question papers. */
export const PRINT_BORDER = "#d1d5db";
/** Meta label colour on question papers. */
export const PRINT_LABEL = "#6b7280";

// ─────────────────────────────────────────────────────────────────────────────
// Common print window CSS helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a CSS string for a standard print-window `body` rule.
 * Used in inline print-window HTML strings to avoid re-declaring the same
 * reset across InvoiceReceiptModal and future print contexts.
 */
export function buildPrintBodyStyle(
  fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
): string {
  return `* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: ${fontStack}; color: ${PRINT_COLORS.black}; background: ${PRINT_COLORS.white}; padding: 20px; }`;
}

export type PrintColorKey = keyof typeof PRINT_COLORS;
