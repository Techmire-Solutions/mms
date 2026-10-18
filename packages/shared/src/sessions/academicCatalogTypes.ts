import { z } from "zod";

/** Tenant-managed academic master-data catalogs (Sessions → Setup). */
export const ACADEMIC_CATALOG_KINDS = ["categories", "programs", "subjects"] as const;
export type AcademicCatalogKind = (typeof ACADEMIC_CATALOG_KINDS)[number];

export const ACADEMIC_CATALOG_STATUSES = ["active", "archived"] as const;
export type AcademicCatalogStatus = (typeof ACADEMIC_CATALOG_STATUSES)[number];

/** Route param schema for `/api/sessions/catalogs/:catalog`. */
export const academicCatalogKindSchema = z.enum(ACADEMIC_CATALOG_KINDS);

const optionalShortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

/** Catalog row as returned by the API. */
export const academicCatalogItemSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().nullable(),
    name: z.string().min(1),
    shortName: z.string().nullable(),
    status: z.enum(ACADEMIC_CATALOG_STATUSES),
    sortOrder: z.number().int(),
    isSystem: z.boolean(),
    deletedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type AcademicCatalogItem = z.infer<typeof academicCatalogItemSchema>;

/** Create/update body (PUT `/api/sessions/catalogs/:catalog/:id`). */
export const academicCatalogWriteSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(150),
    code: optionalShortText(32),
    shortName: optionalShortText(32),
    status: z.enum(ACADEMIC_CATALOG_STATUSES).default("active"),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
  })
  .strict();
export type AcademicCatalogWrite = z.input<typeof academicCatalogWriteSchema>;

export const academicCatalogListQuerySchema = z
  .object({
    includeDeleted: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  })
  .strict();

export interface AcademicCatalogSeed {
  code: string;
  name: string;
}

/** System defaults seeded per workspace (mirrors migration 0166). */
export const DEFAULT_ACADEMIC_CATALOG_SEEDS: Record<
  AcademicCatalogKind,
  readonly AcademicCatalogSeed[]
> = {
  categories: [
    { code: "academic_year", name: "Academic Year" },
    { code: "term", name: "Term" },
    { code: "short_course", name: "Short Course" },
    { code: "workshop", name: "Workshop" },
    { code: "camp", name: "Camp" },
  ],
  programs: [
    { code: "hifz", name: "Hifz" },
    { code: "nazra", name: "Nazra" },
    { code: "qaidah", name: "Qaidah" },
    { code: "tajweed", name: "Tajweed" },
    { code: "dars_e_nizami", name: "Dars-e-Nizami" },
  ],
  subjects: [
    { code: "quran_memorization", name: "Quran Memorization" },
    { code: "quran_recitation", name: "Quran Recitation" },
    { code: "tajweed", name: "Tajweed" },
    { code: "arabic", name: "Arabic" },
    { code: "fiqh", name: "Fiqh" },
    { code: "aqeedah", name: "Aqeedah" },
    { code: "islamic_studies", name: "Islamic Studies" },
  ],
};

/** Category code assigned to sessions that predate categories. */
export const DEFAULT_SESSION_CATEGORY_CODE = "academic_year";

/** Case/whitespace-insensitive key used for catalog name uniqueness (matches the DB index). */
export function academicCatalogNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Active (non-archived, non-deleted) rows, ordered for pickers. */
export function activeAcademicCatalogItems(
  items: readonly AcademicCatalogItem[],
): AcademicCatalogItem[] {
  return items
    .filter((item) => item.status === "active" && !item.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
