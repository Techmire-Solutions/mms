import {
  parseCsvRows,
  type PlatformContactCreateInput,
  type PlatformContactDto,
} from "@mms/contracts";

const VALID_KINDS: readonly PlatformContactDto["kind"][] = [
  "platform_operator",
  "workspace_admin",
  "external",
];

export interface ContactCsvParseResult {
  rows: PlatformContactCreateInput[];
  errors: Array<{ row: number; error: string }>;
  skipped: number;
}

const HEADERS = ["name", "email", "phone", "kind"] as const;

/**
 * Parses a platform-contacts CSV (headers: name, email, phone, kind) into
 * create inputs. Rows with errors are reported per-row; the caller decides
 * whether to block the import.
 */
export function parseContactsCsv(csvText: string): ContactCsvParseResult {
  const grid = parseCsvRows(csvText);
  const [headerRow, ...dataRows] = grid;
  const header = headerRow?.map((cell) => cell.trim().toLowerCase()) ?? [];

  const nameIndex = header.indexOf("name");
  const emailIndex = header.indexOf("email");
  const phoneIndex = header.indexOf("phone");
  const kindIndex = header.indexOf("kind");

  if (nameIndex === -1) {
    return { rows: [], errors: [{ row: 1, error: "Missing required 'name' header" }], skipped: 0 };
  }

  const rows: PlatformContactCreateInput[] = [];
  const errors: Array<{ row: number; error: string }> = [];
  let skipped = 0;

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 2; // 1-based, +1 for the header
    if (cells.every((cell) => cell.trim() === "")) {
      skipped += 1;
      return;
    }
    const name = (cells[nameIndex] ?? "").trim();
    if (!name) {
      errors.push({ row: rowNumber, error: "Missing name" });
      return;
    }
    const email = (cells[emailIndex] ?? "").trim() || null;
    const phone = (cells[phoneIndex] ?? "").trim() || null;
    const kindRaw = (cells[kindIndex] ?? "").trim().toLowerCase();
    const kind = kindRaw === "" ? "external" : kindRaw;
    if (!VALID_KINDS.includes(kind as PlatformContactDto["kind"])) {
      errors.push({ row: rowNumber, error: `Unknown kind '${kindRaw}'` });
      return;
    }
    rows.push({
      name,
      email,
      phone,
      kind: kind as PlatformContactDto["kind"],
      tags: [],
      notes: null,
    });
  });

  return { rows, errors, skipped };
}

export const CONTACTS_IMPORT_TEMPLATE_CSV = `${HEADERS.join(",")}
Jane Doe,jane@example.com,+15550001111,external
`;

/** Header rows exposed to the dialog for the mapping preview. */
export function contactsCsvHeaders(): string[] {
  return [...HEADERS];
}
