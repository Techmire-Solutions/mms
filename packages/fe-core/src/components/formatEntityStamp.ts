/** Normalize entity timestamps (ISO string or Date) for formatDate / banners. */
export function formatEntityStamp(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
}
