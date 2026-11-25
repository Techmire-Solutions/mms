import { z } from "zod";

/** Tag sources owned by a system module; `null` in storage means a manual tag. */
export const CONTACT_TAG_SOURCE_STUDENT = "student" as const;
export const CONTACT_TAG_SOURCE_FACULTY = "faculty" as const;

export type ContactTagSource =
  typeof CONTACT_TAG_SOURCE_STUDENT | typeof CONTACT_TAG_SOURCE_FACULTY;

/** Read-only projection of one system-managed tag. */
export interface ContactSystemTag {
  name: string;
  source: ContactTagSource;
  systemKey: string;
  archived: boolean;
}

export const contactSystemTagSchema = z
  .object({
    name: z.string().min(1).max(200),
    source: z.enum([CONTACT_TAG_SOURCE_STUDENT, CONTACT_TAG_SOURCE_FACULTY]),
    systemKey: z.string().min(1).max(200),
    archived: z.boolean(),
  })
  .strict();

/** Stable system keys — one row per contact per key. */
export const CONTACT_SYSTEM_TAG_KEYS = {
  studentSelf: "student:self",
  studentParent: "student:parent",
  studentGuardian: "student:guardian",
  facultyDesignation: (designationId: string) => `faculty:designation:${designationId}`,
} as const;

export const CONTACT_SYSTEM_TAG_LABELS = {
  studentSelf: "Student",
  studentParent: "Parent",
  studentGuardian: "Guardian",
} as const;

const FACULTY_TAG_PREFIX = "faculty-";
const ARCHIVED_PREFIX = "Former ";
/** Keeps `Former faculty-<name>` inside the 200-char tag column. */
const MAX_DESIGNATION_BASE_LENGTH = 170;

function clampTagName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.length > 199 ? trimmed.slice(0, 199).trim() : trimmed;
}

/** `faculty-Teacher` for a user-defined designation name. */
export function formatFacultySystemTag(designationName: string): string {
  const base = designationName.trim().slice(0, MAX_DESIGNATION_BASE_LENGTH).trim();
  return clampTagName(`${FACULTY_TAG_PREFIX}${base || "Unnamed"}`);
}

/** `Former faculty-Teacher`, `Former Student`, … */
export function formatArchivedSystemTag(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().startsWith(ARCHIVED_PREFIX.toLowerCase())) return trimmed;
  return clampTagName(`${ARCHIVED_PREFIX}${trimmed}`);
}

/** Drops the `Former ` prefix so a row can be reactivated without duplicating text. */
export function systemTagBaseName(name: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().startsWith(ARCHIVED_PREFIX.toLowerCase())
    ? trimmed.slice(ARCHIVED_PREFIX.length).trim()
    : trimmed;
}

/** Case/space-insensitive identity used for duplicate detection. */
export function normalizeContactTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const RESERVED_EXACT_NAMES = new Set(
  [
    CONTACT_SYSTEM_TAG_LABELS.studentSelf,
    CONTACT_SYSTEM_TAG_LABELS.studentParent,
    CONTACT_SYSTEM_TAG_LABELS.studentGuardian,
    formatArchivedSystemTag(CONTACT_SYSTEM_TAG_LABELS.studentSelf),
    formatArchivedSystemTag(CONTACT_SYSTEM_TAG_LABELS.studentParent),
    formatArchivedSystemTag(CONTACT_SYSTEM_TAG_LABELS.studentGuardian),
  ].map((name) => name.toLowerCase()),
);

/**
 * Names owned by a module and therefore not editable by the user:
 * every `faculty-…` / `Former faculty-…` name and the reserved student labels.
 */
export function isReservedSystemTagName(name: string): boolean {
  const normalized = normalizeContactTagName(name);
  if (!normalized) return false;
  if (normalized.startsWith(FACULTY_TAG_PREFIX)) return true;
  if (normalized.startsWith("former faculty-")) return true;
  return RESERVED_EXACT_NAMES.has(normalized);
}

/**
 * Sanitises a manual tag payload: trims, dedupes case-insensitively, and drops
 * names reserved for system modules so a manual write can never shadow them.
 */
export function filterManualContactTags(tags: readonly string[] | null | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const name = String(raw ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!name) continue;
    if (isReservedSystemTagName(name)) continue;
    const key = normalizeContactTagName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/** Splits a read model into editable manual names and read-only system metadata. */
export function splitContactTags(
  contact?: {
    tags?: string[] | null;
    systemTags?: ContactSystemTag[] | null;
  } | null,
): { manualTags: string[]; systemTags: ContactSystemTag[] } {
  const systemTags = Array.isArray(contact?.systemTags) ? contact.systemTags : [];
  const systemNames = new Set(systemTags.map((tag) => normalizeContactTagName(tag.name)));
  const manualTags = filterManualContactTags(
    (contact?.tags ?? []).filter((name) => !systemNames.has(normalizeContactTagName(name))),
  );
  return { manualTags, systemTags };
}
