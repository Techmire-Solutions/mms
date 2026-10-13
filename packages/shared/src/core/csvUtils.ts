// OWASP CSV-injection triggers: = + - @, plus a leading tab or carriage return
// (which Excel/Sheets strip before interpreting the formula).
const FORMULA_INJECTION_PREFIX = /^[=+\-@\t\r]/;
// A formula character hidden behind leading whitespace is still evaluated.
const WHITESPACE_FORMULA_PREFIX = /^\s+[=+\-@]/;
// Plain negative numeric strings are data, not formulas — a leading `-` must survive.
const NEGATIVE_NUMERIC_STRING = /^-(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Escapes a CSV cell and neutralises spreadsheet formula injection.
 *
 * Numeric values (and negative numeric strings) are never prefixed, so legitimate
 * negative amounts/IDs are not corrupted into text.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === "number") {
    return `"${String(value)}"`;
  }
  const raw = typeof value === "string" ? value : String(value);
  if (!raw) return '""';
  const looksLikeFormula =
    FORMULA_INJECTION_PREFIX.test(raw) || WHITESPACE_FORMULA_PREFIX.test(raw);
  const safe = looksLikeFormula && !NEGATIVE_NUMERIC_STRING.test(raw.trim()) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Builds a CSV document from row arrays. */
export function buildCsvContent(rows: unknown[][]): string {
  const rowCount = rows.length;
  if (rowCount === 0) return "";

  const lines = new Array<string>(rowCount);
  for (let i = 0; i < rowCount; i++) {
    const row = rows[i];
    const colCount = row.length;
    let line = "";
    for (let j = 0; j < colCount; j++) {
      if (j > 0) line += ",";
      line += escapeCsvCell(row[j]);
    }
    lines[i] = line;
  }
  return lines.join("\n");
}

/**
 * Ensures an export filename starts with the tenant/workspace name.
 * Sanitizes unsafe characters and prevents duplicate prefixes.
 */
export function buildTenantExportFilename(
  tenantName: string | null | undefined,
  baseFilename: string,
): string {
  const cleanBase = (typeof baseFilename === "string" ? baseFilename : "").trim() || "export.csv";
  if (!tenantName || typeof tenantName !== "string" || !tenantName.trim()) return cleanBase;

  const cleanTenant = tenantName
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!cleanTenant) return cleanBase;

  const lowerBase = cleanBase.toLowerCase();
  const lowerTenant = cleanTenant.toLowerCase();
  if (
    lowerBase === lowerTenant ||
    lowerBase.startsWith(`${lowerTenant}_`) ||
    lowerBase.startsWith(`${lowerTenant}-`) ||
    lowerBase.startsWith(`${lowerTenant}.`)
  ) {
    return cleanBase;
  }

  return `${cleanTenant}_${cleanBase}`;
}
