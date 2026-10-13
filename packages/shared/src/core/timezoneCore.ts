/** Select option for IANA timezone pickers. */
export interface TimezoneOption {
  value: string;
  label: string;
  region: string;
  offsetMinutes: number;
  /** Lowercase search tokens (id, city, region). */
  keywords: string;
}

export const REGION_ORDER = [
  "UTC",
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Europe",
  "Indian",
  "Pacific",
] as const;

/** Curated fallback when `Intl.supportedValuesOf` is unavailable. */
const IANA_TIMEZONE_FALLBACK: readonly string[] = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Baghdad",
  "Asia/Dubai",
  "Asia/Dhaka",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Paris",
  "Pacific/Auckland",
];

/**
 * Returns all IANA timezone identifiers from the runtime (ICU), with a curated fallback.
 */
export function getIanaTimeZoneIds(): readonly string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      const zones = Intl.supportedValuesOf("timeZone");
      if (zones.length > 0) return zones;
    } catch {
      /* use fallback */
    }
  }
  return IANA_TIMEZONE_FALLBACK;
}

/**
 * Detects the device/browser IANA timezone.
 */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getTimezoneRegion(id: string): string {
  if (id === "UTC") return "UTC";
  const slash = id.indexOf("/");
  return slash === -1 ? "Other" : id.slice(0, slash);
}

export function formatCityName(id: string): string {
  if (id === "UTC") return "UTC";
  const segment = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  return segment.replace(/_/g, " ");
}

/**
 * UTC offset in minutes for sorting (e.g. Asia/Karachi → 300).
 */
export function getTimezoneOffsetMinutes(id: string, date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      timeZoneName: "shortOffset",
    });
    const token = formatter.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
    const match = token.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
    if (!match) return 0;
    const sign = match[1] === "+" ? 1 : -1;
    const hours = Number.parseInt(match[2], 10);
    const minutes = Number.parseInt(match[3] ?? "0", 10);
    return sign * (hours * 60 + minutes);
  } catch {
    return 0;
  }
}

function formatOffsetLabel(id: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      timeZoneName: "shortOffset",
    });
    return formatter.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  } catch {
    return "GMT";
  }
}

/**
 * Human-readable label: `GMT+5 · Karachi`.
 */
export function formatTimezoneLabel(id: string, _locale = "en", date: Date = new Date()): string {
  const offset = formatOffsetLabel(id, date);
  const city = formatCityName(id);
  return id === "UTC" ? "UTC" : `${offset} · ${city}`;
}

export function isValidIanaTimezone(id: string): boolean {
  if (!id.trim()) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: id });
    return true;
  } catch {
    return false;
  }
}

/**
 * Coerces an arbitrary stored value to a valid IANA id (falls back to default).
 */
export function normalizeTimezone(value: string | undefined, fallback = "UTC"): string {
  const trimmed = value?.trim();
  if (trimmed && isValidIanaTimezone(trimmed)) return trimmed;
  if (isValidIanaTimezone(fallback)) return fallback;
  return "UTC";
}
