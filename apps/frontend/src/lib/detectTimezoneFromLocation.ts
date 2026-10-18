import { DEFAULT_GLOBAL_SETTINGS, detectBrowserTimezone, normalizeTimezone } from "@mms/shared";

export type TimezoneDetectionSource = "geolocation" | "device";

export type TimezoneDetectionFailure =
  | "geolocation_unsupported"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "timezone_lookup_failed";

export type TimezoneDetectionResult =
  | { ok: true; timezone: string; source: TimezoneDetectionSource }
  | { ok: false; code: TimezoneDetectionFailure; fallbackTimezone: string };

const DEFAULT_TIMEOUT_MS = 12_000;

function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function getCurrentPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 300_000,
      timeout: timeoutMs,
    });
  });
}

function mapGeolocationError(error: GeolocationPositionError): TimezoneDetectionFailure {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "permission_denied";
    case error.POSITION_UNAVAILABLE:
      return "position_unavailable";
    case error.TIMEOUT:
      return "timeout";
    default:
      return "position_unavailable";
  }
}

/**
 * Maps GPS coordinates to an IANA timezone (offline boundary lookup).
 */
export async function resolveTimezoneFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const tzLookup = (await import("@photostructure/tz-lookup")).default as (
      lat: number,
      lon: number,
    ) => string;
    const id = tzLookup(latitude, longitude);
    return normalizeTimezone(id, DEFAULT_GLOBAL_SETTINGS.timezone);
  } catch {
    return null;
  }
}

/**
 * Resolves timezone from GPS when permitted; otherwise reports failure with device fallback id.
 */
export async function detectTimezoneFromLocation(options?: {
  timeoutMs?: number;
}): Promise<TimezoneDetectionResult> {
  const fallbackTimezone = normalizeTimezone(
    detectBrowserTimezone(),
    DEFAULT_GLOBAL_SETTINGS.timezone,
  );

  if (!isGeolocationSupported()) {
    return { ok: false, code: "geolocation_unsupported", fallbackTimezone };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const position = await getCurrentPosition(timeoutMs);
    const timezone = await resolveTimezoneFromCoordinates(
      position.coords.latitude,
      position.coords.longitude,
    );

    if (!timezone) {
      return { ok: false, code: "timezone_lookup_failed", fallbackTimezone };
    }

    return { ok: true, timezone, source: "geolocation" };
  } catch (error) {
    const code =
      error instanceof GeolocationPositionError
        ? mapGeolocationError(error)
        : "position_unavailable";
    return { ok: false, code, fallbackTimezone };
  }
}
