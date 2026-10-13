import type { CommandItem } from "@/components/ui/commandPaletteItems";

export const RECENTS_KEY = "cmd:recents";
export const MAX_RECENTS = 5;

export function getRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function pushRecent(id: string): void {
  const prev = getRecents().filter((r) => r !== id);
  localStorage.setItem(RECENTS_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENTS)));
}

/** Trigram similarity — returns 0-1 score; tolerates single-char typos. */
export function trigramScore(text: string, query: string): number {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 1.0;
  if (t.includes(q)) return 0.8;
  const buildTrigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    const padded = `  ${s}  `;
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  };
  const tg = buildTrigrams(t);
  const qg = buildTrigrams(q);
  let matches = 0;
  qg.forEach((tri) => {
    if (tg.has(tri)) matches++;
  });
  return matches / Math.max(tg.size, qg.size);
}

/**
 * Filter and rank command items by query.
 * Prioritizes exact/substring matches (score >= 0.8); falls back to high-confidence fuzzy matches (>= 0.45).
 */
export function filterCommandItems(
  items: readonly CommandItem[],
  query: string,
  translate: (key: string) => string,
): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];

  const scored = items.map((item) => {
    const translatedLabel = translate(item.labelKey) || item.fallbackLabel;
    const labelScore = trigramScore(translatedLabel, q);
    const fallbackScore = trigramScore(item.fallbackLabel, q);
    const keywordScore = Math.max(0, ...item.keywords.map((k) => trigramScore(k, q)));
    const score = Math.max(labelScore, fallbackScore, keywordScore);
    return { item, score };
  });

  const exact = scored.filter((s) => s.score >= 0.8);
  if (exact.length > 0) return exact.map((s) => s.item);

  return scored
    .filter((s) => s.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);
}
