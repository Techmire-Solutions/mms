/**
 * @file moduleColumnWidthPresets.ts
 * @description Content-kind width presets for Work directory columns (default + floor per kind).
 */

export const MODULE_COLUMN_WIDTH_MIN = 80;
export const MODULE_COLUMN_WIDTH_MAX = 640;

/** Clamp a user-resized column width to the supported range. */
export function clampModuleColumnWidth(width: number): number {
  if (!Number.isFinite(width)) return MODULE_COLUMN_WIDTH_MIN;
  return Math.min(MODULE_COLUMN_WIDTH_MAX, Math.max(MODULE_COLUMN_WIDTH_MIN, Math.round(width)));
}

/** What a column holds; drives its default width and the narrowest width it may shrink to. */
export const MODULE_COLUMN_KINDS = [
  "identity",
  "title",
  "person",
  "phone",
  "email",
  "date",
  "dualDate",
  "dateTime",
  "money",
  "number",
  "status",
  "boolean",
  "chips",
  "reference",
  "code",
  "shortText",
  "longText",
] as const;

export type ModuleColumnKind = (typeof MODULE_COLUMN_KINDS)[number];

export interface ModuleColumnKindWidth {
  /** Default pixel width before any user resize. */
  width: number;
  /** Narrowest width that still fits the kind's content; stored widths below it are raised. */
  minWidth: number;
}

/** Default and minimum pixel widths per column kind. */
export const MODULE_COLUMN_KIND_WIDTHS: Readonly<Record<ModuleColumnKind, ModuleColumnKindWidth>> =
  {
    identity: { width: 240, minWidth: 180 },
    title: { width: 220, minWidth: 160 },
    person: { width: 200, minWidth: 150 },
    phone: { width: 220, minWidth: 200 },
    email: { width: 230, minWidth: 180 },
    date: { width: 130, minWidth: 110 },
    dualDate: { width: 170, minWidth: 140 },
    dateTime: { width: 170, minWidth: 140 },
    money: { width: 130, minWidth: 100 },
    number: { width: 100, minWidth: 80 },
    status: { width: 130, minWidth: 100 },
    boolean: { width: 100, minWidth: 80 },
    chips: { width: 230, minWidth: 180 },
    reference: { width: 140, minWidth: 100 },
    code: { width: 100, minWidth: 80 },
    shortText: { width: 150, minWidth: 100 },
    longText: { width: 260, minWidth: 160 },
  };

/**
 * Effective column width: the stored/registry width (or the kind default when absent),
 * raised to the kind minimum and clamped to the global bounds.
 * Returns `undefined` only when there is neither a positive width nor a kind.
 */
export function resolveModuleColumnWidth(
  width: number | undefined,
  kind: ModuleColumnKind | undefined,
): number | undefined {
  // `0` and non-finite values mean "auto" (unsized), never the global minimum.
  const usable =
    typeof width === "number" && Number.isFinite(width) && width > 0 ? width : undefined;
  if (!kind) return usable === undefined ? undefined : clampModuleColumnWidth(usable);
  const preset = MODULE_COLUMN_KIND_WIDTHS[kind];
  return clampModuleColumnWidth(Math.max(usable ?? preset.width, preset.minWidth));
}

/**
 * Tags each entry whose key appears in `kinds` with that kind and resolves its width
 * (kind default when unsized, raised to the kind floor when narrower). Other entries pass through.
 */
export function applyModuleColumnKinds<
  T extends { key: string; width?: number; kind?: ModuleColumnKind },
>(entries: readonly T[], kinds: Readonly<Partial<Record<string, ModuleColumnKind>>>): T[] {
  return entries.map((entry) => {
    const kind = Object.hasOwn(kinds, entry.key) ? kinds[entry.key] : undefined;
    if (!kind) return entry;
    return { ...entry, kind, width: resolveModuleColumnWidth(entry.width, kind) };
  });
}
