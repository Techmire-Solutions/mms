import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WORKSHOP_ATTENDANCE_STATUSES,
  WORKSHOP_LIFECYCLE_STATES,
  WORKSHOP_PARTICIPANT_STATUSES,
} from "@mms/shared";

const MIGRATIONS = path.join(process.cwd(), "src/db/migrations_drizzle");
const SCHEMA_FILES = [
  path.join(process.cwd(), "src/db/schema/workshops.ts"),
  path.join(process.cwd(), "src/db/schema/workshopActivityTables.ts"),
];

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS, name), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(MIGRATIONS, relativePath), "utf8")) as T;
}

interface Journal {
  entries: Array<{ idx: number; tag: string }>;
}

interface Snapshot {
  id: string;
  prevId: string;
  tables: Record<
    string,
    {
      columns: Record<string, { type: string; notNull: boolean }>;
      indexes: Record<
        string,
        { name: string; columns: Array<{ expression: string }>; where?: string }
      >;
      foreignKeys: Record<
        string,
        { name: string; tableTo: string; columnsFrom: string[]; columnsTo: string[] }
      >;
      checkConstraints: Record<string, { name: string; value: string }>;
    }
  >;
}

/**
 * Pins the 0244 integrity change set. `drizzle-kit generate` is blocked by a pre-existing snapshot
 * collision (0216/0217 share a parent), so the migration is hand-authored — these assertions are
 * what keeps it honest against the Drizzle schema and the shared status unions.
 */
describe("workshops integrity migration (0244)", () => {
  const sql = readMigration("0244_workshops_integrity.sql");
  const schema = SCHEMA_FILES.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const journal = readJson<Journal>("meta/_journal.json");

  it("is tracked in the drizzle journal", () => {
    const entry = journal.entries.find((item) => item.tag === "0244_workshops_integrity");
    expect(entry).toBeDefined();
    expect(entry?.idx).toBe(244);
  });

  it("adds the active calendar/list index with the right predicate", () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "workshop_events_workspace_active_dates_idx"[\s\S]*?\("workspace_subdomain", "start_date", "end_date"\)[\s\S]*?WHERE "deleted_at" IS NULL/,
    );
    expect(schema).toContain('"workshop_events_workspace_active_dates_idx"');
  });

  it("enforces the registration deadline inside the workshop window without blocking the backfill", () => {
    expect(sql).toContain('ADD CONSTRAINT "workshop_events_deadline_check"');
    expect(sql).toContain('VALIDATE CONSTRAINT "workshop_events_deadline_check"');
    expect(sql).toMatch(/ADD CONSTRAINT "workshop_events_deadline_check"[\s\S]*?NOT VALID/);
  });

  it("scopes attendance and scores to the participant's own workshop", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "workshop_participants_workshop_scoped_uidx"[\s\S]*?\("workspace_subdomain", "id", "workshop_id"\)/,
    );
    // The repair must run before the foreign keys validate, otherwise a pre-existing mismatch
    // aborts the whole migration.
    expect(sql.indexOf('UPDATE "workshop_attendance"')).toBeGreaterThan(-1);
    expect(sql.indexOf('UPDATE "workshop_attendance"')).toBeLessThan(
      sql.indexOf('ADD CONSTRAINT "workshop_attendance_participant_fk"'),
    );
    expect(sql).toMatch(
      /FOREIGN KEY \("workspace_subdomain", "participant_id", "workshop_id"\)[\s\S]*?REFERENCES "workshop_participants" \("workspace_subdomain", "id", "workshop_id"\)/,
    );
    expect(schema).toContain('"workshop_participants_workshop_scoped_uidx"');
    expect(schema).toContain('"workshop_attendance_participant_fk"');
    expect(schema).toContain('"workshop_scores_participant_fk"');
  });

  it("keeps the 0244 snapshot chained to 0243 with the same definitions", () => {
    const previous = readJson<Snapshot>("meta/0243_question_bank_taxonomy_checks_snapshot.json");
    const snapshot = readJson<Snapshot>("meta/0244_workshops_integrity_snapshot.json");

    expect(snapshot.prevId).toBe(previous.id);
    expect(snapshot.id).not.toBe(previous.id);

    const events = snapshot.tables["public.workshop_events"]!;
    expect(events.indexes["workshop_events_workspace_active_dates_idx"]).toBeDefined();
    expect(events.checkConstraints["workshop_events_deadline_check"]).toBeDefined();

    const participants = snapshot.tables["public.workshop_participants"]!;
    expect(participants.indexes["workshop_participants_workshop_scoped_uidx"]).toBeDefined();

    for (const table of ["public.workshop_attendance", "public.workshop_scores"]) {
      const participantFk = Object.values(snapshot.tables[table]!.foreignKeys).find(
        (fk) => fk.tableTo === "workshop_participants",
      );
      expect(participantFk?.columnsFrom, table).toEqual([
        "workspace_subdomain",
        "participant_id",
        "workshop_id",
      ]);
      expect(participantFk?.columnsTo, table).toEqual(["workspace_subdomain", "id", "workshop_id"]);
    }
  });

  it("adds the persisted lifecycle status with its CHECK in 0245", () => {
    const lifecycleSql = readMigration("0245_workshops_lifecycle.sql");
    expect(lifecycleSql).toMatch(
      /ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "status" varchar\(20\) NOT NULL DEFAULT 'open'/,
    );
    expect(lifecycleSql).toContain('ADD CONSTRAINT "workshop_events_status_check"');
    expect(lifecycleSql).toContain('VALIDATE CONSTRAINT "workshop_events_status_check"');
    expect(schema).toContain('"workshop_events_status_check"');
    expect(schema).toContain('varchar("status", { length: 20 }).notNull().default("open")');

    const journalEntry = journal.entries.find((item) => item.tag === "0245_workshops_lifecycle");
    expect(journalEntry?.idx).toBe(245);
  });

  it("keeps the 0245 snapshot chained to 0244 with the status column and CHECK", () => {
    const previous = readJson<Snapshot>("meta/0244_workshops_integrity_snapshot.json");
    const snapshot = readJson<Snapshot>("meta/0245_workshops_lifecycle_snapshot.json");
    expect(snapshot.prevId).toBe(previous.id);

    const events = snapshot.tables["public.workshop_events"]!;
    expect(events.checkConstraints["workshop_events_status_check"]).toBeDefined();
    expect(events.columns.status).toMatchObject({ type: "varchar(20)", notNull: true });
  });

  it("adds the waitlist columns, guard and promotion index in 0246", () => {
    const waitlistSql = readMigration("0246_workshop_waitlist.sql");
    expect(waitlistSql).toMatch(
      /ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "waitlist_enabled" boolean NOT NULL DEFAULT false/,
    );
    expect(waitlistSql).toMatch(
      /ALTER TABLE "workshop_participants" ADD COLUMN IF NOT EXISTS "waitlisted_at" (?:timestamptz|timestamp with time zone)/,
    );
    expect(waitlistSql).toContain('ADD CONSTRAINT "workshop_participants_waitlist_check"');
    expect(waitlistSql).toContain('VALIDATE CONSTRAINT "workshop_participants_waitlist_check"');
    expect(waitlistSql).toMatch(
      /CREATE INDEX IF NOT EXISTS "workshop_participants_workshop_waitlist_idx"[\s\S]*?WHERE "deleted_at" IS NULL AND "waitlisted_at" IS NOT NULL/,
    );
    expect(schema).toContain('"workshop_participants_workshop_waitlist_idx"');

    const journalEntry = journal.entries.find((item) => item.tag === "0246_workshop_waitlist");
    expect(journalEntry?.idx).toBe(246);
  });

  it("keeps the 0246 snapshot chained to 0245 with the waitlist definitions", () => {
    const previous = readJson<Snapshot>("meta/0245_workshops_lifecycle_snapshot.json");
    const snapshot = readJson<Snapshot>("meta/0246_workshop_waitlist_snapshot.json");
    expect(snapshot.prevId).toBe(previous.id);

    const events = snapshot.tables["public.workshop_events"]!;
    expect(events.columns.waitlist_enabled).toMatchObject({ type: "boolean", notNull: true });
    const participants = snapshot.tables["public.workshop_participants"]!;
    expect(participants.columns.waitlisted_at).toMatchObject({ notNull: false });
    expect(participants.checkConstraints["workshop_participants_waitlist_check"]).toBeDefined();
    expect(participants.indexes["workshop_participants_workshop_waitlist_idx"]).toBeDefined();
  });

  it("adds the covering analytics indexes in 0247", () => {
    const analyticsSql = readMigration("0247_workshop_analytics_indexes.sql");
    expect(analyticsSql).toContain('"workshop_events_ws_status_dates_active_idx"');
    expect(analyticsSql).toContain('"workshop_participants_ws_active_workshop_idx"');
    expect(analyticsSql).toContain('"workshop_participants_ws_active_status_idx"');
    expect(analyticsSql).toContain('"workshop_attendance_ws_workshop_day_status_idx"');
    expect(analyticsSql).toMatch(
      /workshop_participants_ws_active_workshop_idx"[\s\S]*?WHERE "deleted_at" IS NULL AND "waitlisted_at" IS NULL/,
    );
    expect(schema).toContain('"workshop_events_ws_status_dates_active_idx"');

    const entry = journal.entries.find((item) => item.tag === "0247_workshop_analytics_indexes");
    expect(entry?.idx).toBe(247);
  });

  it("chains the 0247 snapshot to 0246 with the new indexes", () => {
    const previous = readJson<Snapshot>("meta/0246_workshop_waitlist_snapshot.json");
    const snapshot = readJson<Snapshot>("meta/0247_workshop_analytics_indexes_snapshot.json");
    expect(snapshot.prevId).toBe(previous.id);
    expect(
      snapshot.tables["public.workshop_events"]!.indexes[
        "workshop_events_ws_status_dates_active_idx"
      ],
    ).toBeDefined();
    expect(
      snapshot.tables["public.workshop_participants"]!.indexes[
        "workshop_participants_ws_active_status_idx"
      ],
    ).toBeDefined();
    expect(
      snapshot.tables["public.workshop_attendance"]!.indexes[
        "workshop_attendance_ws_workshop_day_status_idx"
      ],
    ).toBeDefined();
  });

  it("mirrors the status CHECKs that 0185 added in raw SQL", () => {
    const defineSql = readMigration("0185_workshops_module.sql");
    const dbLists = [...defineSql.matchAll(/CHECK \("status" IN \(([^)]*)\)\)/g)].map((match) =>
      [...match[1]!.matchAll(/'([a-z_]+)'/g)].map((value) => value[1]!),
    );

    const sorted = (values: readonly string[]) => [...values].sort();
    expect(
      dbLists.some(
        (list) =>
          JSON.stringify(sorted(list)) === JSON.stringify(sorted(WORKSHOP_PARTICIPANT_STATUSES)),
      ),
    ).toBe(true);
    expect(
      dbLists.some(
        (list) =>
          JSON.stringify(sorted(list)) === JSON.stringify(sorted(WORKSHOP_ATTENDANCE_STATUSES)),
      ),
    ).toBe(true);
    expect(schema).toContain('"workshop_participants_status_check"');
    expect(schema).toContain('"workshop_attendance_status_check"');

    // The event status CHECK lives in 0245; keep it pinned to the shared lifecycle tuple too.
    const lifecycleSql = readMigration("0245_workshops_lifecycle.sql");
    const eventStatus = /CHECK \("status" IN \(([^)]*)\)\)/.exec(lifecycleSql)?.[1] ?? "";
    const eventStatuses = [...eventStatus.matchAll(/'([a-z_]+)'/g)].map((value) => value[1]!);
    expect(sorted(eventStatuses)).toEqual(sorted(WORKSHOP_LIFECYCLE_STATES));
  });
});
