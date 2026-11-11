import { describe, expect, it } from "vitest";
import * as persist from "../db/repositories/examinationResultsPersist.js";

/**
 * Surface guard for the marks write path.
 *
 * The behaviour (OCC, publish/archive/cancelled locks, per-mark audit) is proven against real
 * Postgres in `db-integration/examinationIntegrityDb` and `db-integration/examinationSubsystemsDb`;
 * this spec pins the exported write surface the use-cases compose, so a rename cannot silently
 * orphan a caller between the DB runs.
 */
describe("examinationResultsPersist write surface", () => {
  it("exports the marks write entry points used by the use-cases", () => {
    expect(typeof persist.saveExamResult).toBe("function");
    expect(typeof persist.bulkSaveExamResults).toBe("function");
    expect(typeof persist.replaceExamResultsForWorkspace).toBe("function");
    expect(typeof persist.deleteExaminationsByWorkspace).toBe("function");
  });
});
