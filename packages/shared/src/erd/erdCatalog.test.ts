import { describe, expect, it } from "vitest";
import {
  ERD_DOMAIN_IDS,
  ERD_DOMAINS,
  buildErdMermaid,
  filterErdDomainByTable,
  getErdDomain,
  isErdDomainId,
  listErdTableNames,
} from "./erdCatalog.js";

describe("erdCatalog", () => {
  it("registers every domain id exactly once", () => {
    const ids = ERD_DOMAINS.map((domain) => domain.id);
    expect(ids).toEqual([...ERD_DOMAIN_IDS]);
    expect(new Set(ids).size).toBe(ERD_DOMAIN_IDS.length);
  });

  it("narrows domain ids and looks up accounting tables", () => {
    expect(isErdDomainId("accounting")).toBe(true);
    expect(isErdDomainId("unknown")).toBe(false);
    const accounting = getErdDomain("accounting");
    expect(listErdTableNames(accounting.tables)).toEqual([
      "accounting_accounts",
      "accounting_bank_reconciliations",
      "accounting_bank_statement_lines",
      "accounting_bank_statements",
      "accounting_entries",
      "accounting_entry_attachments",
      "accounting_entry_tags",
      "accounting_fiscal_years",
      "accounting_journal_lines",
      "accounting_opening_balances",
      "accounting_posting_rules",
    ]);
  });

  it("keeps relationship endpoints inside the domain table set", () => {
    for (const domain of ERD_DOMAINS) {
      const names = new Set(domain.tables.map((table) => table.name));
      for (const rel of domain.relationships) {
        expect(names.has(rel.fromTable), `${domain.id}: missing ${rel.fromTable}`).toBe(true);
        expect(names.has(rel.toTable), `${domain.id}: missing ${rel.toTable}`).toBe(true);
      }
    }
  });

  it("filters a domain ERD to a table and its one-hop neighbors", () => {
    const filtered = filterErdDomainByTable(getErdDomain("accounting"), "accounting_entries");
    expect(listErdTableNames(filtered.tables)).toEqual([
      "accounting_bank_reconciliations",
      "accounting_entries",
      "accounting_entry_attachments",
      "accounting_entry_tags",
      "accounting_fiscal_years",
      "accounting_journal_lines",
    ]);
    expect(
      filtered.relationships.every(
        (rel) => rel.fromTable === "accounting_entries" || rel.toTable === "accounting_entries",
      ),
    ).toBe(true);
  });

  it("includes students, classes, and sessions on the attendance ERD", () => {
    const attendance = getErdDomain("attendance");
    expect(listErdTableNames(attendance.tables)).toEqual([
      "attendance",
      "attendance_leaves",
      "session_classes",
      "sessions",
      "students",
    ]);
    const source = buildErdMermaid(attendance);
    expect(source).toMatch(/attendance \}o--\|\| session_classes : class_id/);
    expect(source).toMatch(/session_classes \}o--\|\| sessions : session_id/);
    expect(source).toContain("varchar_64_ class_id FK");
  });

  it("includes students and session classes when focusing attendance marks", () => {
    const filtered = filterErdDomainByTable(getErdDomain("attendance"), "attendance");
    expect(listErdTableNames(filtered.tables)).toEqual([
      "attendance",
      "session_classes",
      "students",
    ]);
  });

  it("emits a Mermaid erDiagram with PK/FK columns and crow-foot edges", () => {
    const source = buildErdMermaid(getErdDomain("accounting"));
    expect(source.startsWith("erDiagram")).toBe(true);
    expect(source).toContain("accounting_accounts {");
    expect(source).toContain("text id PK");
    expect(source).toContain("text account_id FK");
    expect(source).toMatch(/accounting_journal_lines \}o--\|\| accounting_entries : entry_id/);
    expect(source).toMatch(/accounting_journal_lines \}o--\|\| accounting_accounts : account_id/);
    expect(source).toMatch(/accounting_entries \}o--\|\| accounting_fiscal_years : fiscal_year_id/);
  });

  it("looks up faculty domain with hierarchy relationship", () => {
    expect(isErdDomainId("faculty")).toBe(true);
    expect(isErdDomainId("teachers")).toBe(false);
    const faculty = getErdDomain("faculty");
    expect(faculty.id).toBe("faculty");
    expect(listErdTableNames(faculty.tables)).toContain("faculty");
    expect(listErdTableNames(faculty.tables)).toContain("faculty_lookups");
  });
});
