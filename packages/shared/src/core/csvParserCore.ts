/**
 * Pure RFC 4180 compliant CSV parser.
 * Handles quoted fields, embedded commas, CRLF/LF newlines, and escaped double quotes ("").
 */
export function parseCsvRows(csvText: string): string[][] {
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      currentField += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
      i++;
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && i + 1 < len && text[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentField);
      currentField = "";
      if (currentRow.some((field) => field.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((field) => field.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}
