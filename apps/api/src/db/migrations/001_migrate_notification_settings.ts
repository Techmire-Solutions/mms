/**
 * @file 001_migrate_notification_settings.ts
 * @description Migration 001: Move domain-specific notification flags from global_settings
 * to their respective domain settings objects.
 *
 * Moves:
 *   global_settings.attendanceAlerts → attendance_settings.attendanceAlerts
 *   global_settings.feeReminders     → finance_settings.feeReminders
 *   global_settings.examReminders    → examinations_settings.examReminders
 *
 * This migration is idempotent — safe to run multiple times.
 */

import { getObject, saveObject } from "../database.js";

/** Internal representation of the pre-migration global_settings shape. */
interface LegacyGlobalSettings extends Record<string, unknown> {
  attendanceAlerts?: boolean;
  feeReminders?: boolean;
  examReminders?: boolean;
}

/** Minimal shape we need from attendance_settings. */
interface AttendanceSettingsRecord extends Record<string, unknown> {
  attendanceAlerts?: boolean;
}

/** Minimal shape we need from finance_settings. */
interface FinanceSettingsRecord extends Record<string, unknown> {
  feeReminders?: boolean;
}

/** Minimal shape we need from examinations_settings. */
interface ExaminationsSettingsRecord extends Record<string, unknown> {
  examReminders?: boolean;
}

/**
 * Runs migration 001: relocates three notification flags from the global settings
 * object to their respective domain settings objects.
 *
 * @returns {boolean} true if any changes were written, false if the migration was a no-op.
 */
export async function runMigration001(): Promise<boolean> {
  let globalSettings: LegacyGlobalSettings | null;
  try {
    globalSettings = (await getObject("global_settings")) as LegacyGlobalSettings | null;
  } catch (err: unknown) {
    // Fresh schema: objects table doesn't exist yet — nothing to migrate.
    const code =
      (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
    if (code === "42P01") return false;
    throw err;
  }
  if (!globalSettings) {
    // Nothing to migrate — database has not been seeded yet.
    return false;
  }

  const hasAttendanceAlert = "attendanceAlerts" in globalSettings;
  const hasFeeReminders = "feeReminders" in globalSettings;
  const hasExamReminders = "examReminders" in globalSettings;

  // Nothing to migrate if none of the legacy fields exist.
  if (!hasAttendanceAlert && !hasFeeReminders && !hasExamReminders) {
    return false;
  }

  console.log(
    "[Migration 001] Migrating notification flags from global_settings to domain settings...",
  );

  // ── attendance_settings ───────────────────────────────────────────────────
  if (hasAttendanceAlert) {
    const attendanceSettings = ((await getObject("attendance_settings")) ??
      {}) as AttendanceSettingsRecord;
    // Only set if not already present in the target (idempotency guard)
    if (!("attendanceAlerts" in attendanceSettings)) {
      attendanceSettings.attendanceAlerts = globalSettings.attendanceAlerts ?? true;
      await saveObject("attendance_settings", attendanceSettings);
      console.log("[Migration 001]  ✓ attendanceAlerts moved to attendance_settings");
    }
  }

  // ── finance_settings ──────────────────────────────────────────────────────
  if (hasFeeReminders) {
    const financeSettings = ((await getObject("finance_settings")) ?? {}) as FinanceSettingsRecord;
    if (!("feeReminders" in financeSettings)) {
      financeSettings.feeReminders = globalSettings.feeReminders ?? true;
      await saveObject("finance_settings", financeSettings);
      console.log("[Migration 001]  ✓ feeReminders moved to finance_settings");
    }
  }

  // ── examinations_settings ─────────────────────────────────────────────────
  if (hasExamReminders) {
    const examinationsSettings = ((await getObject("examinations_settings")) ??
      {}) as ExaminationsSettingsRecord;
    if (!("examReminders" in examinationsSettings)) {
      examinationsSettings.examReminders = globalSettings.examReminders ?? true;
      await saveObject("examinations_settings", examinationsSettings);
      console.log("[Migration 001]  ✓ examReminders moved to examinations_settings");
    }
  }

  // ── Strip the three fields from global_settings ───────────────────────────
  const { attendanceAlerts, feeReminders, examReminders, ...cleanedGlobal } = globalSettings;
  await saveObject("global_settings", cleanedGlobal);
  console.log("[Migration 001]  ✓ Legacy fields removed from global_settings");

  // Suppress "unused variable" warnings — the fields are intentionally destructured away.
  void attendanceAlerts;
  void feeReminders;
  void examReminders;

  console.log("[Migration 001] Migration completed successfully.");
  return true;
}
