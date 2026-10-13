import { normalizeDateFormat, normalizeTwoDigitYear } from "./dateFormatPresets.js";

/**
 * Parses a display-pattern date string into ISO storage form (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`).
 * Supports:
 * - Year only: "2024" -> "2024"
 * - Month and Year: "05/2024", "05-2024", "2024-05" -> "2024-05"
 * - Complete Date: "21/05/2024", "2024-05-21" -> "2024-05-21"
 * Also supports compact strings without separators (e.g. `2024`, `052024`, `202405`, `21072026`).
 */
export function parseDisplayDateToIso(
  display: string | null | undefined,
  formatId: string,
): string {
  if (!display || typeof display !== "string" || !display.trim()) return "";
  const id = normalizeDateFormat(formatId);
  const trimmed = display.trim();

  // 1. Year only: 4 digits (e.g. "2024")
  if (/^\d{4}$/.test(trimmed)) {
    const y = Number(trimmed);
    if (y >= 1000 && y <= 9999) {
      return String(y);
    }
    return "";
  }

  // 2. Handle compact 6- or 8-digit strings without separators
  if (/^\d{6}$|^\d{8}$/.test(trimmed)) {
    if (trimmed.length === 6) {
      // Check for YYYYMM (e.g. "202405")
      if (id.startsWith("YYYY") && Number(trimmed.slice(0, 4)) >= 1000) {
        const year = Number(trimmed.slice(0, 4));
        const month = Number(trimmed.slice(4, 6));
        if (month >= 1 && month <= 12) {
          return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
        }
      }
      // Check for MMYYYY (e.g. "052024")
      const monthCandidate = Number(trimmed.slice(0, 2));
      const yearCandidate = Number(trimmed.slice(2, 6));
      if (
        yearCandidate >= 1000 &&
        yearCandidate <= 9999 &&
        monthCandidate >= 1 &&
        monthCandidate <= 12
      ) {
        return `${String(yearCandidate).padStart(4, "0")}-${String(monthCandidate).padStart(2, "0")}`;
      }

      // Compact 6-digit with 2-digit year (e.g. "210795")
      let year: number;
      let month: number;
      let day: number;
      if (id.startsWith("YYYY")) {
        year = Number(trimmed.slice(0, 2));
        month = Number(trimmed.slice(2, 4));
        day = Number(trimmed.slice(4, 6));
      } else if (id === "MM/DD/YYYY") {
        month = Number(trimmed.slice(0, 2));
        day = Number(trimmed.slice(2, 4));
        year = Number(trimmed.slice(4, 6));
      } else {
        day = Number(trimmed.slice(0, 2));
        month = Number(trimmed.slice(2, 4));
        year = Number(trimmed.slice(4, 6));
      }
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const normalizedYear = normalizeTwoDigitYear(year);
        const probe = new Date(normalizedYear, month - 1, day);
        if (
          probe.getFullYear() === normalizedYear &&
          probe.getMonth() === month - 1 &&
          probe.getDate() === day
        ) {
          return `${String(normalizedYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    } else if (trimmed.length === 8) {
      let year: number;
      let month: number;
      let day: number;
      if (id.startsWith("YYYY")) {
        year = Number(trimmed.slice(0, 4));
        month = Number(trimmed.slice(4, 6));
        day = Number(trimmed.slice(6, 8));
      } else if (id === "MM/DD/YYYY") {
        month = Number(trimmed.slice(0, 2));
        day = Number(trimmed.slice(2, 4));
        year = Number(trimmed.slice(4, 8));
      } else {
        day = Number(trimmed.slice(0, 2));
        month = Number(trimmed.slice(2, 4));
        year = Number(trimmed.slice(4, 8));
      }
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const normalizedYear = normalizeTwoDigitYear(year);
        const probe = new Date(normalizedYear, month - 1, day);
        if (
          probe.getFullYear() === normalizedYear &&
          probe.getMonth() === month - 1 &&
          probe.getDate() === day
        ) {
          return `${String(normalizedYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }
  }

  // 3. Separated strings
  const cleaned = trimmed.replace(/\//g, "-").replace(/\./g, "-");
  const segments = cleaned
    .split("-")
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 1) {
    if (/^\d{4}$/.test(segments[0]!)) {
      const y = Number(segments[0]);
      if (y >= 1000 && y <= 9999) return String(y);
    }
    return "";
  }

  // 2 segments: Month and Year (e.g. "05/2024", "2024-05")
  if (segments.length === 2) {
    let year: number;
    let month: number;

    if (segments[0]!.length === 4) {
      year = Number(segments[0]);
      month = Number(segments[1]);
    } else if (segments[1]!.length === 4) {
      month = Number(segments[0]);
      year = Number(segments[1]);
    } else if (id.startsWith("YYYY")) {
      year = normalizeTwoDigitYear(Number(segments[0]));
      month = Number(segments[1]);
    } else {
      month = Number(segments[0]);
      year = normalizeTwoDigitYear(Number(segments[1]));
    }

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      year >= 1000 &&
      year <= 9999 &&
      month >= 1 &&
      month <= 12
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
    }
    return "";
  }

  // 3 segments: Complete Date (Day, Month, Year)
  if (segments.length === 3) {
    let year: number;
    let month: number;
    let day: number;

    if (segments[0]!.length === 4) {
      year = Number(segments[0]);
      month = Number(segments[1]);
      day = Number(segments[2]);
    } else if (id === "MM/DD/YYYY") {
      month = Number(segments[0]);
      day = Number(segments[1]);
      year = Number(segments[2]);
    } else if (id === "YYYY-MM-DD" || id === "YYYY/MM/DD") {
      year = Number(segments[0]);
      month = Number(segments[1]);
      day = Number(segments[2]);
    } else {
      day = Number(segments[0]);
      month = Number(segments[1]);
      year = Number(segments[2]);
    }

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return "";
    }

    const normalizedYear = normalizeTwoDigitYear(year);
    const probe = new Date(normalizedYear, month - 1, day);
    if (
      probe.getFullYear() !== normalizedYear ||
      probe.getMonth() !== month - 1 ||
      probe.getDate() !== day
    ) {
      return "";
    }

    return `${String(normalizedYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return "";
}
