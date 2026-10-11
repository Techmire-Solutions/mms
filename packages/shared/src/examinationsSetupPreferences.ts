/** Examinations module preferences: schema, type, and normalization. */
import { z } from "zod";
import { DEFAULT_EXAMINATIONS_SETTINGS } from "./examinationsModuleSettings.js";

/** PUT /api/examinations/preferences — examinations prefs only. */
export const examinationsPreferencesPutBodySchema = z
  .object({
    passMark: z.string().optional(),
    maxMark: z.string().optional(),
    gradingSystem: z.string().optional(),
    showRankings: z.boolean().optional(),
    allowRetake: z.boolean().optional(),
    autoPublishResults: z.boolean().optional(),
    notifyOnResult: z.boolean().optional(),
    certificateTemplate: z.string().optional(),
    aiGrading: z.boolean().optional(),
    distinguishHonours: z.boolean().optional(),
    examReminders: z.boolean().optional(),
    defaultViewLayout: z.string().optional(),
  })
  .passthrough();

/** Typed preference state extracted from legacy ExaminationsSettings. */
export interface ExaminationsModulePreferences {
  passMark: string;
  maxMark: string;
  gradingSystem: string;
  showRankings: boolean;
  allowRetake: boolean;
  autoPublishResults: boolean;
  notifyOnResult: boolean;
  certificateTemplate: string;
  aiGrading: boolean;
  distinguishHonours: boolean;
  examReminders: boolean;
  defaultViewLayout: string;
}

/** Extracts preferences slice from a raw composed settings blob. */
export function normalizeExaminationsModulePreferences(
  raw: unknown,
): ExaminationsModulePreferences {
  if (!raw || typeof raw !== "object") {
    return {
      passMark: DEFAULT_EXAMINATIONS_SETTINGS.passMark,
      maxMark: DEFAULT_EXAMINATIONS_SETTINGS.maxMark,
      gradingSystem: DEFAULT_EXAMINATIONS_SETTINGS.gradingSystem,
      showRankings: DEFAULT_EXAMINATIONS_SETTINGS.showRankings,
      allowRetake: DEFAULT_EXAMINATIONS_SETTINGS.allowRetake,
      autoPublishResults: DEFAULT_EXAMINATIONS_SETTINGS.autoPublishResults,
      notifyOnResult: DEFAULT_EXAMINATIONS_SETTINGS.notifyOnResult,
      certificateTemplate: DEFAULT_EXAMINATIONS_SETTINGS.certificateTemplate,
      aiGrading: DEFAULT_EXAMINATIONS_SETTINGS.aiGrading,
      distinguishHonours: DEFAULT_EXAMINATIONS_SETTINGS.distinguishHonours,
      examReminders: DEFAULT_EXAMINATIONS_SETTINGS.examReminders,
      defaultViewLayout: DEFAULT_EXAMINATIONS_SETTINGS.defaultViewLayout || "list",
    };
  }

  const prefs = raw as Partial<ExaminationsModulePreferences>;
  return {
    passMark:
      typeof prefs.passMark === "string" ? prefs.passMark : DEFAULT_EXAMINATIONS_SETTINGS.passMark,
    maxMark:
      typeof prefs.maxMark === "string" ? prefs.maxMark : DEFAULT_EXAMINATIONS_SETTINGS.maxMark,
    gradingSystem:
      typeof prefs.gradingSystem === "string"
        ? prefs.gradingSystem
        : DEFAULT_EXAMINATIONS_SETTINGS.gradingSystem,
    showRankings:
      typeof prefs.showRankings === "boolean"
        ? prefs.showRankings
        : DEFAULT_EXAMINATIONS_SETTINGS.showRankings,
    allowRetake:
      typeof prefs.allowRetake === "boolean"
        ? prefs.allowRetake
        : DEFAULT_EXAMINATIONS_SETTINGS.allowRetake,
    autoPublishResults:
      typeof prefs.autoPublishResults === "boolean"
        ? prefs.autoPublishResults
        : DEFAULT_EXAMINATIONS_SETTINGS.autoPublishResults,
    notifyOnResult:
      typeof prefs.notifyOnResult === "boolean"
        ? prefs.notifyOnResult
        : DEFAULT_EXAMINATIONS_SETTINGS.notifyOnResult,
    certificateTemplate:
      typeof prefs.certificateTemplate === "string"
        ? prefs.certificateTemplate
        : DEFAULT_EXAMINATIONS_SETTINGS.certificateTemplate,
    aiGrading:
      typeof prefs.aiGrading === "boolean"
        ? prefs.aiGrading
        : DEFAULT_EXAMINATIONS_SETTINGS.aiGrading,
    distinguishHonours:
      typeof prefs.distinguishHonours === "boolean"
        ? prefs.distinguishHonours
        : DEFAULT_EXAMINATIONS_SETTINGS.distinguishHonours,
    examReminders:
      typeof prefs.examReminders === "boolean"
        ? prefs.examReminders
        : DEFAULT_EXAMINATIONS_SETTINGS.examReminders,
    defaultViewLayout:
      typeof prefs.defaultViewLayout === "string"
        ? prefs.defaultViewLayout
        : DEFAULT_EXAMINATIONS_SETTINGS.defaultViewLayout || "list",
  };
}
