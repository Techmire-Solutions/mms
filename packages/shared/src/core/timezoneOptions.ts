import {
  REGION_ORDER,
  formatCityName,
  formatTimezoneLabel,
  getIanaTimeZoneIds,
  getTimezoneOffsetMinutes,
  getTimezoneRegion,
  type TimezoneOption,
} from "./timezoneCore.js";

const optionCache = new Map<string, readonly TimezoneOption[]>();

function buildSearchKeywords(id: string, region: string): string {
  return [id, region, formatCityName(id)].join(" ").toLowerCase();
}

/**
 * Builds sorted timezone options grouped by region (cached per locale).
 */
export function getTimezoneOptions(locale = "en"): readonly TimezoneOption[] {
  const cached = optionCache.get(locale);
  if (cached) return cached;

  const now = new Date();
  const timezoneIds = getIanaTimeZoneIds();
  const options: TimezoneOption[] = timezoneIds.map((timezoneId) => {
    const region = getTimezoneRegion(timezoneId);
    return {
      value: timezoneId,
      label: formatTimezoneLabel(timezoneId, locale, now),
      region,
      offsetMinutes: getTimezoneOffsetMinutes(timezoneId, now),
      keywords: buildSearchKeywords(timezoneId, region),
    };
  });

  const regionRank = (region: string): number => {
    const regionIndex = REGION_ORDER.indexOf(region as (typeof REGION_ORDER)[number]);
    return regionIndex === -1 ? REGION_ORDER.length : regionIndex;
  };

  options.sort((leftOption, rightOption) => {
    const regionDelta = regionRank(leftOption.region) - regionRank(rightOption.region);
    if (regionDelta !== 0) return regionDelta;
    if (leftOption.offsetMinutes !== rightOption.offsetMinutes)
      return leftOption.offsetMinutes - rightOption.offsetMinutes;
    return leftOption.label.localeCompare(rightOption.label, locale);
  });

  optionCache.set(locale, options);
  return options;
}

/**
 * Returns true when `id` is a known IANA timezone in this runtime.
 */
/**
 * Groups options by region for optgroup / command list rendering.
 */
export function groupTimezoneOptions(
  options: readonly TimezoneOption[],
): { region: string; options: TimezoneOption[] }[] {
  const optionsByRegion = new Map<string, TimezoneOption[]>();
  for (const option of options) {
    const regionOptions = optionsByRegion.get(option.region) ?? [];
    regionOptions.push(option);
    optionsByRegion.set(option.region, regionOptions);
  }

  const regions = [...optionsByRegion.keys()].sort((leftRegion, rightRegion) => {
    const rank = (region: string) => {
      const regionIndex = REGION_ORDER.indexOf(region as (typeof REGION_ORDER)[number]);
      return regionIndex === -1 ? REGION_ORDER.length : regionIndex;
    };
    return rank(leftRegion) - rank(rightRegion);
  });

  return regions.map((region) => ({ region, options: optionsByRegion.get(region)! }));
}
