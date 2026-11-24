/** Stable slug fragment for lookup option ids (Contacts + Students). */
export function slugifyLookupLabel(label: string, index: number): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "item"}-${index}`;
}
