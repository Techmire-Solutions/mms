import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENROLLMENT_PAYMENT_STATUSES,
  ENROLLMENT_STATUSES,
  REGISTRATION_APPLICATION_STATUSES,
  SEAT_RELEASED_ENROLLMENT_STATUSES,
} from "@mms/shared";

const MIGRATIONS = path.join(process.cwd(), "src/db/migrations_drizzle");

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS, name), "utf8");
}

/** Extract the quoted values inside the first `... IN (...)` group after `anchor`. */
function inListAfter(sql: string, anchor: string): string[] {
  const anchorIndex = sql.indexOf(anchor);
  if (anchorIndex === -1) throw new Error(`anchor not found: ${anchor}`);
  const inIndex = sql.indexOf("IN (", anchorIndex);
  const open = sql.indexOf("(", inIndex);
  const close = sql.indexOf(")", open);
  const values = sql.slice(open + 1, close);
  return [...values.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]!);
}

describe("enrollment lifecycle enum ↔ database parity", () => {
  it("status whitelist matches the shared EnrollmentStatus union", () => {
    const sql = readMigration("0210_enrollments_integrity.sql");
    const dbValues = inListAfter(sql, 'CHECK ("status" IN');
    expect([...dbValues].sort()).toEqual([...ENROLLMENT_STATUSES].sort());
  });

  it("seat-released lists match the shared released statuses", () => {
    for (const migration of [
      "0181_academic_contract.sql",
      "0213_enrollment_membership_archive_guard.sql",
    ]) {
      const sql = readMigration(migration);
      const released = [...new Set(inListAfter(sql, '"status" NOT IN'))];
      expect([...released].sort(), migration).toEqual(
        [...SEAT_RELEASED_ENROLLMENT_STATUSES].sort(),
      );
    }
  });

  it("registration application statuses match the shared union", () => {
    const sql = readMigration("0174_registration.sql");
    const dbValues = inListAfter(sql, '"status" IN');
    expect([...dbValues].sort()).toEqual([...REGISTRATION_APPLICATION_STATUSES].sort());
  });

  it("completion status check matches the shared schema values", () => {
    const sql = readMigration("0178_short_courses_workshops.sql");
    const dbValues = inListAfter(sql, '"completion_status" IN');
    expect([...dbValues].sort()).toEqual(["completed", "not_completed"]);
  });

  it("payment status check matches the shared union", () => {
    const sql = readMigration("0217_enrollment_payment_status_check.sql");
    const dbValues = inListAfter(sql, '"payment_status" IN');
    expect([...dbValues].sort()).toEqual([...ENROLLMENT_PAYMENT_STATUSES].sort());
  });
});
