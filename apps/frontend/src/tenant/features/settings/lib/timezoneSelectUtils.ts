import { type groupTimezoneOptions, type AppTranslationKey } from "@mms/shared";

export function filterGroupedTimezones(
  grouped: ReturnType<typeof groupTimezoneOptions>,
  query: string,
): ReturnType<typeof groupTimezoneOptions> {
  const searchQuery = query.trim().toLowerCase();
  if (!searchQuery) return grouped;
  return grouped
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          option.keywords.includes(searchQuery) || option.label.toLowerCase().includes(searchQuery),
      ),
    }))
    .filter((group) => group.options.length > 0);
}

export function timezoneDetectionErrorKey(
  code:
    | "geolocation_unsupported"
    | "permission_denied"
    | "position_unavailable"
    | "timeout"
    | "timezone_lookup_failed",
): AppTranslationKey {
  const detectionErrorKeys: Record<typeof code, AppTranslationKey> = {
    geolocation_unsupported: "global.timezoneDetectUnsupported",
    permission_denied: "global.timezoneDetectDenied",
    position_unavailable: "global.timezoneDetectUnavailable",
    timeout: "global.timezoneDetectTimeout",
    timezone_lookup_failed: "global.timezoneDetectFailed",
  };
  return detectionErrorKeys[code];
}
