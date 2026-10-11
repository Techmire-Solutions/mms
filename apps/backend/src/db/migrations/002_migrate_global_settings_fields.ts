/**
 * @file 002_migrate_global_settings_fields.ts
 * @description Migration 002: Move domain-specific configuration fields from
 * global_settings into their respective domain settings objects.
 *
 * Moves:
 *   global_settings.currency      → finance_settings.currency
 *   global_settings.academicYear  → sessions_settings.academicYear
 *   global_settings.sessionStart  → sessions_settings.sessionStart
 *
 * After this migration global_settings holds only truly system-wide, cross-cutting
 * configuration (language, timezone, dateFormat, notification master toggles, auth
 * policy, and UI theme).
 *
 * This migration is idempotent — safe to run multiple times.
 */

import { getObject, saveObject } from "../database.js";

/** Pre-migration shape of global_settings (the three domain fields are optional). */
interface LegacyGlobalSettings extends Record<string, unknown> {
  currency?: string;
  academicYear?: string;
  sessionStart?: string;
}

/** Minimal shape needed from finance_settings. */
interface FinanceSettingsRecord extends Record<string, unknown> {
  currency?: string;
}

/** Minimal shape needed from sessions_settings. */
interface SessionsSettingsRecord extends Record<string, unknown> {
  academicYear?: string;
  sessionStart?: string;
}

/**
 * Runs migration 002: relocates currency, academicYear, and sessionStart from
 * global_settings into their respective domain settings objects.
 *
 * @returns {boolean} true if any changes were written, false if the migration was a no-op.
 */
export async function runMigration002(): Promise<boolean> {
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

  const hasCurrency = "currency" in globalSettings;
  const hasAcademicYear = "academicYear" in globalSettings;
  const hasSessionStart = "sessionStart" in globalSettings;

  // Nothing to migrate if none of the legacy fields exist.
  if (!hasCurrency && !hasAcademicYear && !hasSessionStart) {
    return false;
  }

  console.log("[Migration 002] Migrating domain fields from global_settings to domain settings...");

  // ── finance_settings ──────────────────────────────────────────────────────
  if (hasCurrency) {
    const financeSettings = ((await getObject("finance_settings")) ?? {}) as FinanceSettingsRecord;
    // Only set if not already present in the target (idempotency guard).
    if (
      !("currency" in financeSettings) &&
      typeof globalSettings.currency === "string" &&
      globalSettings.currency.trim()
    ) {
      financeSettings.currency = globalSettings.currency.trim();
      await saveObject("finance_settings", financeSettings);
      console.log("[Migration 002]  ✓ currency moved to finance_settings");
    }
  }

  // ── sessions_settings ──────────────────────────────────────────────────────
  const sessionsSettingsRecord = ((await getObject("sessions_settings")) ??
    {}) as SessionsSettingsRecord;
  let sessionsModified = false;

  if (
    hasAcademicYear &&
    !("academicYear" in sessionsSettingsRecord) &&
    typeof globalSettings.academicYear === "string" &&
    globalSettings.academicYear.trim()
  ) {
    sessionsSettingsRecord.academicYear = globalSettings.academicYear.trim();
    sessionsModified = true;
    console.log("[Migration 002]  ✓ academicYear moved to sessions_settings");
  }

  if (
    hasSessionStart &&
    !("sessionStart" in sessionsSettingsRecord) &&
    typeof globalSettings.sessionStart === "string" &&
    globalSettings.sessionStart.trim()
  ) {
    sessionsSettingsRecord.sessionStart = globalSettings.sessionStart.trim();
    sessionsModified = true;
    console.log("[Migration 002]  ✓ sessionStart moved to sessions_settings");
  }

  if (sessionsModified) {
    await saveObject("sessions_settings", sessionsSettingsRecord);
  }

  // ── Strip the three fields from global_settings ────────────────────────────
  const { currency, academicYear, sessionStart, ...cleanedGlobal } = globalSettings;
  await saveObject("global_settings", cleanedGlobal);
  console.log("[Migration 002]  ✓ Legacy domain fields removed from global_settings");

  // Suppress "unused variable" warnings — fields are intentionally destructured away.
  void currency;
  void academicYear;
  void sessionStart;

  console.log("[Migration 002] Migration completed successfully.");
  return true;
}
