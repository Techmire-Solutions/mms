import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("Faculty contact / employee-id SQL SSOT", () => {
  it("list repo exposes linked-contact and next-employee-id SQL helpers", () => {
    const listBarrelSrc = readFileSync(
      join(here, "../db/repositories/facultyRepositoryList.ts"),
      "utf8",
    );
    const listQuerySqlSrc = readFileSync(
      join(here, "../db/repositories/facultyRepositoryListQuerySql.ts"),
      "utf8",
    );
    expect(listBarrelSrc).toContain("listFacultyLinkedContactIdsSql");
    expect(listBarrelSrc).toContain("countFacultyForNextEmployeeId");
    expect(listQuerySqlSrc).toContain("joinedContactNameExpr");
    expect(listQuerySqlSrc).toContain("joinedContactGenderExpr");
  });

  it("contacts list faculty link filter uses typed contact_id", () => {
    const linkSqlSrc = readFileSync(
      join(here, "../db/repositories/contactRepositoryLinkSql.ts"),
      "utf8",
    );
    expect(linkSqlSrc).toContain("existsActiveFacultyLinkSql");
    expect(linkSqlSrc).toContain("facultyEmployments.contactId");
    expect(linkSqlSrc).toContain("faculty.employmentId");
    expect(linkSqlSrc).not.toContain("faculty.customData}->>'contactId'");
    expect(linkSqlSrc).not.toContain("faculty.contactId");
  });
});
