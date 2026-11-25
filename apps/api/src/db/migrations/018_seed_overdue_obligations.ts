/**
 * Legacy migration id 018 — originally seeded empty `overdue_obligations` collections.
 * That entity is retired (dashboard derives overdue fees from finance invoices).
 * Kept as a no-op so applied migration history stays contiguous.
 */
export async function runMigration018(): Promise<void> {
  // no-op
}
