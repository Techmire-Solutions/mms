/**
 * @file searchPatternUtils.ts
 * @description Pure utility for normalizing user search terms and converting wildcards (* and ?) to SQL LIKE patterns.
 */

/**
 * Converts a user search string into a SQL LIKE/ILIKE pattern supporting wildcards:
 * - '*' matches 0 or more characters (mapped to SQL '%')
 * - '?' matches any single character (mapped to SQL '_')
 * - If no wildcard characters are present, wraps in '%...%' for substring match.
 */
export function toSqlSearchPattern(search?: string | null): string {
  if (!search) return "%";
  const trimmed = search.trim();
  if (!trimmed) return "%";

  if (trimmed.includes("*") || trimmed.includes("?")) {
    return trimmed.replace(/\*/g, "%").replace(/\?/g, "_");
  }

  return `%${trimmed}%`;
}

/**
 * Tests whether a haystack matches a user search term supporting wildcards:
 * - '*' matches zero or more characters
 * - '?' matches any single character
 * - terms without wildcards match as substrings
 */
export function matchesWildcardSearch(haystack: string, term: string): boolean {
  if (!term) return true;
  const trimmed = term.trim();
  if (!trimmed) return true;

  if (trimmed.includes("*") || trimmed.includes("?")) {
    const rawPattern = trimmed
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const regexPattern = `^${rawPattern}$`;
    try {
      const re = new RegExp(regexPattern, "i");
      if (re.test(haystack)) return true;
      return haystack.split(/\s+/).some((word) => re.test(word));
    } catch {
      return haystack.toLowerCase().includes(trimmed.toLowerCase());
    }
  }

  return haystack.toLowerCase().includes(trimmed.toLowerCase());
}
