import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const listSrc = readFileSync(
  join(process.cwd(), "src/db/repositories/studentRepositoryListQuery.ts"),
  "utf8",
);

describe("studentRepositoryList Contacts SSOT", () => {
  it("filters and sorts gender/dob/name from linked contacts, not student columns", () => {
    expect(listSrc).toContain("linkedContactGenderExpr");
    expect(listSrc).toContain("linkedContactDobExpr");
    expect(listSrc).toContain("linkedContactNameSortExpr");
    expect(listSrc).toContain("SELECT c.gender");
    expect(listSrc).toContain("SELECT c.dob");
    expect(listSrc).toContain("FROM ${contacts} c");
    expect(listSrc).not.toMatch(/students\.(gender|dob)/);
  });

  it("searches contact display name and keeps student GR / studentId / cnic", () => {
    expect(listSrc).toContain("lower(COALESCE(c.name, ''))");
    expect(listSrc).toContain("COALESCE(${students.grNumber}, '')");
    expect(listSrc).toContain("COALESCE(${students.studentId}, '')");
    expect(listSrc).toContain("COALESCE(c.cnic, '')");
  });

  it("filters related contact IDs against father, mother, and guardian contact IDs", () => {
    expect(listSrc).toContain("${students.fatherContactId} IN");
    expect(listSrc).toContain("${students.motherContactId} IN");
    expect(listSrc).toContain("${students.guardianContactId} IN");
  });

  it("searches fatherName across both student column and linked father contact", () => {
    expect(listSrc).toContain("COALESCE(${students.fatherName}");
    expect(listSrc).toContain("fc.workspace_subdomain = ${students.workspaceSubdomain}");
    expect(listSrc).toContain("fc.id = ${students.fatherContactId}");
  });

  it("guards registeredDate date casting with ISO regex pattern", () => {
    expect(listSrc).toContain("^[0-9]{4}-[0-9]{2}-[0-9]{2}");
  });
});
