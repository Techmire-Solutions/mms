/**
 * Utility helpers for formatting social platform URLs and validating date ranges.
 */

const SOCIAL_BASE_URLS: Record<string, string> = {
  twitter: "https://x.com/",
  x: "https://x.com/",
  facebook: "https://facebook.com/",
  instagram: "https://instagram.com/",
  linkedin: "https://linkedin.com/in/",
  youtube: "https://youtube.com/@",
  github: "https://github.com/",
  tiktok: "https://tiktok.com/@",
  whatsapp: "https://wa.me/",
  telegram: "https://t.me/",
};

/**
 * Formats a raw handle or username into a canonical profile URL for standard social platforms.
 * Leaves full URLs (starting with http://, https://, etc.) untouched.
 */
export function formatSocialPlatformUrl(platform: string, input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return trimmed;
  }

  const normalizedPlatform = platform.trim().toLowerCase();
  const baseUrl = SOCIAL_BASE_URLS[normalizedPlatform];
  if (!baseUrl) {
    // If it looks like a domain, prepend https://
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  const cleanHandle = trimmed.replace(/^[@/]+/, "");
  if (!cleanHandle) return "";

  // If handle already contains domain part (e.g. linkedin.com/in/foo)
  if (cleanHandle.includes(".")) {
    return `https://${cleanHandle}`;
  }

  return `${baseUrl}${cleanHandle}`;
}

/**
 * Validates that startDate is chronologically less than or equal to endDate.
 * Supports standard formats: YYYY, YYYY-MM, YYYY-MM-DD.
 * Returns true if both dates are valid and startDate <= endDate, or if either date is empty.
 */
export function isChronologicalDateRangeValid(
  startDate?: string | null,
  endDate?: string | null,
): boolean {
  if (!startDate || !endDate) return true;

  const start = startDate.trim();
  const end = endDate.trim();
  if (!start || !end) return true;

  // Compare lexicographically if format matches YYYY or YYYY-MM or YYYY-MM-DD
  const isYearOnly = /^\d{4}$/;
  if (isYearOnly.test(start) && isYearOnly.test(end)) {
    return parseInt(start, 10) <= parseInt(end, 10);
  }

  const startDateObj = new Date(start);
  const endDateObj = new Date(end);

  if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
    return startDateObj.getTime() <= endDateObj.getTime();
  }

  // Fallback to lexicographical comparison
  return start <= end;
}
