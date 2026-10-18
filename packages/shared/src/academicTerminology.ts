import { z } from 'zod';
import type { AppLanguageCode } from './languageUtils.js';

/** Academic structure terms a tenant may relabel (e.g. Class → "Darja", Section → "Group"). */
export const ACADEMIC_TERM_KEYS = ['session', 'class', 'section'] as const;
export type AcademicTermKey = (typeof ACADEMIC_TERM_KEYS)[number];

/** Languages that can carry terminology overrides. */
export const ACADEMIC_TERM_LANGUAGES = ['en', 'ar', 'ur', 'fa'] as const satisfies readonly AppLanguageCode[];

export const ACADEMIC_TERM_MAX_LENGTH = 40;

export interface AcademicTermLabel {
  singular: string;
  plural: string;
}

/** Per-language overrides; missing entries fall back to the translation pack. */
export type AcademicTerminology = Partial<Record<AppLanguageCode, Partial<Record<AcademicTermKey, AcademicTermLabel>>>>;

const termLabelSchema = z.object({
  singular: z.string().trim().max(ACADEMIC_TERM_MAX_LENGTH),
  plural: z.string().trim().max(ACADEMIC_TERM_MAX_LENGTH),
}).strict();

const languageTermsSchema = z.object({
  session: termLabelSchema.optional(),
  class: termLabelSchema.optional(),
  section: termLabelSchema.optional(),
}).strict();

/** Validates a terminology override map (stored in Sessions module preferences). */
export const academicTerminologySchema = z.object({
  en: languageTermsSchema.optional(),
  ar: languageTermsSchema.optional(),
  ur: languageTermsSchema.optional(),
  fa: languageTermsSchema.optional(),
}).strict();

function cleanLabel(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, ACADEMIC_TERM_MAX_LENGTH) : '';
}

/** Drops unknown languages/keys and empty labels so only real overrides are stored. */
export function normalizeAcademicTerminology(raw: unknown): AcademicTerminology {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const result: AcademicTerminology = {};
  for (const language of ACADEMIC_TERM_LANGUAGES) {
    const terms = source[language];
    if (!terms || typeof terms !== 'object') continue;
    const entries: Partial<Record<AcademicTermKey, AcademicTermLabel>> = {};
    for (const key of ACADEMIC_TERM_KEYS) {
      const label = (terms as Record<string, unknown>)[key];
      if (!label || typeof label !== 'object') continue;
      const singular = cleanLabel((label as Record<string, unknown>).singular);
      const plural = cleanLabel((label as Record<string, unknown>).plural);
      if (singular || plural) entries[key] = { singular, plural };
    }
    if (Object.keys(entries).length > 0) result[language] = entries;
  }
  return result;
}

/** Resolves one term for a language: override (per field) → fallback labels. */
export function resolveAcademicTerm(
  terminology: AcademicTerminology | undefined,
  language: string,
  key: AcademicTermKey,
  fallback: AcademicTermLabel,
): AcademicTermLabel {
  const override = terminology?.[language as AppLanguageCode]?.[key];
  return {
    singular: override?.singular || fallback.singular,
    plural: override?.plural || fallback.plural,
  };
}
