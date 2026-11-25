/** Examinations module preferences: schema, type, and normalization. */
import { z } from "zod";
import { DEFAULT_EXAMINATIONS_SETTINGS } from "./examinationsModuleSettings.js";

/**
 * Grading systems the module advertises. `gpa`/`rubric` have no scoring implementation yet
 * (decision D3): the value is stored and shown, while percentages/letter bands remain the engine.
 */
export const EXAM_GRADING_SYSTEMS = ["percentage", "letter", "gpa", "rubric"] as const;
export type ExamGradingSystem = (typeof EXAM_GRADING_SYSTEMS)[number];

export function isExamGradingSystem(value: unknown): value is ExamGradingSystem {
  return typeof value === "string" && (EXAM_GRADING_SYSTEMS as readonly string[]).includes(value);
}

/** Canonical preferences shape (the GET response and the stored, normalized settings slice). */
export const examinationsPreferencesSchema = z
  .object({
    passMark: z.string(),
    maxMark: z.string(),
    gradingSystem: z.enum(EXAM_GRADING_SYSTEMS),
    showRankings: z.boolean(),
    allowRetake: z.boolean(),
    autoPublishResults: z.boolean(),
    notifyOnResult: z.boolean(),
    certificateTemplate: z.string(),
    aiGrading: z.boolean(),
    distinguishHonours: z.boolean(),
    examReminders: z.boolean(),
    defaultViewLayout: z.string(),
  })
  .strict();

/** PUT /api/examinations/preferences — partial preferences only; unknown keys are rejected. */
export const examinationsPreferencesPutBodySchema = examinationsPreferencesSchema
  .partial()
  .strict();

export type ExaminationsModulePreferences = z.infer<typeof examinationsPreferencesSchema>;
export type ExaminationsPreferencesPatch = z.infer<typeof examinationsPreferencesPutBodySchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Extracts the preferences slice from a raw composed settings blob.
 *
 * Legacy blobs may carry arbitrary values (the preference was stored as free text before the
 * grading enum existed), so the read path is tolerant and falls back per field; the PUT boundary
 * is strict and rejects unknown values instead of silently storing them.
 */
export function normalizeExaminationsModulePreferences(
  raw: unknown,
): ExaminationsModulePreferences {
  const source = isRecord(raw) ? raw : {};
  const text = (key: keyof ExaminationsModulePreferences, fallback: string): string =>
    typeof source[key] === "string" ? (source[key] as string) : fallback;
  const flag = (key: keyof ExaminationsModulePreferences, fallback: boolean): boolean =>
    typeof source[key] === "boolean" ? (source[key] as boolean) : fallback;
  const defaults = DEFAULT_EXAMINATIONS_SETTINGS;

  return examinationsPreferencesSchema.parse({
    passMark: text("passMark", defaults.passMark),
    maxMark: text("maxMark", defaults.maxMark),
    gradingSystem: isExamGradingSystem(source.gradingSystem)
      ? source.gradingSystem
      : defaults.gradingSystem,
    showRankings: flag("showRankings", defaults.showRankings),
    allowRetake: flag("allowRetake", defaults.allowRetake),
    autoPublishResults: flag("autoPublishResults", defaults.autoPublishResults),
    notifyOnResult: flag("notifyOnResult", defaults.notifyOnResult),
    certificateTemplate: text("certificateTemplate", defaults.certificateTemplate),
    aiGrading: flag("aiGrading", defaults.aiGrading),
    distinguishHonours: flag("distinguishHonours", defaults.distinguishHonours),
    examReminders: flag("examReminders", defaults.examReminders),
    defaultViewLayout: text("defaultViewLayout", defaults.defaultViewLayout ?? "list"),
  } satisfies ExaminationsModulePreferences);
}
