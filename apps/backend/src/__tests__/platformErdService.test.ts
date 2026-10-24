import { describe, expect, it, beforeEach } from "vitest";
import {
  getIntrospectedErdDomains,
  resetIntrospectedErdCache,
} from "../services/platform/platformErdService.js";

describe("platformErdService", () => {
  beforeEach(() => {
    resetIntrospectedErdCache();
  });

  it("introspects all active Drizzle domains dynamically", () => {
    const result = getIntrospectedErdDomains();

    expect(result.success).toBe(true);
    expect(result.totalTables).toBeGreaterThan(50);
    expect(result.domains.length).toBeGreaterThanOrEqual(18);

    const domainIds = result.domains.map((d) => d.id);
    expect(domainIds).toContain("contacts");
    expect(domainIds).toContain("students");
    expect(domainIds).toContain("finance");
    expect(domainIds).toContain("accounting");
  });

  it("introspects all normalized contact sub-collections and configuration tables in contacts domain", () => {
    const result = getIntrospectedErdDomains();
    const contactsDomain = result.domains.find((d) => d.id === "contacts");
    expect(contactsDomain).toBeDefined();

    const tableNames = new Set(contactsDomain!.tables.map((t) => t.name));
    expect(tableNames.has("contacts")).toBe(true);
    expect(tableNames.has("contact_phones")).toBe(true);
    expect(tableNames.has("contact_emails")).toBe(true);
    expect(tableNames.has("contact_addresses")).toBe(true);
    expect(tableNames.has("contact_tags")).toBe(true);
    expect(tableNames.has("contact_socials")).toBe(true);
    expect(tableNames.has("contact_educations")).toBe(true);
    expect(tableNames.has("contact_experiences")).toBe(true);
    expect(tableNames.has("contact_skills")).toBe(true);
    expect(tableNames.has("contact_relationships")).toBe(true);
    expect(tableNames.has("contact_bank_details")).toBe(true);
    expect(tableNames.has("contact_lookups")).toBe(true);
    expect(tableNames.has("contact_field_configs")).toBe(true);
    expect(tableNames.has("contact_module_preferences")).toBe(true);
  });

  it("introspects all modern audit trail tables in the system domain", () => {
    const result = getIntrospectedErdDomains();
    const systemDomain = result.domains.find((d) => d.id === "system");
    expect(systemDomain).toBeDefined();

    const tableNames = new Set(systemDomain!.tables.map((t) => t.name));
    expect(tableNames.has("audit_trail_events")).toBe(true);
    expect(tableNames.has("audit_verification_runs")).toBe(true);
    expect(tableNames.has("audit_merkle_roots")).toBe(true);
    expect(tableNames.has("crypto_shredding_keys")).toBe(true);
    expect(tableNames.has("audit_erasure_requests")).toBe(true);
    expect(tableNames.has("background_jobs")).toBe(true);
    expect(tableNames.has("saved_reports")).toBe(true);
    expect(tableNames.has("user_activity_logs")).toBe(true);
  });

  it("preserves relationship integrity where both endpoints exist in domain tables", () => {
    const result = getIntrospectedErdDomains();
    for (const domain of result.domains) {
      const tableNames = new Set(domain.tables.map((t) => t.name));
      for (const rel of domain.relationships) {
        expect(
          tableNames.has(rel.fromTable),
          `${domain.id}: missing fromTable ${rel.fromTable}`,
        ).toBe(true);
        expect(tableNames.has(rel.toTable), `${domain.id}: missing toTable ${rel.toTable}`).toBe(
          true,
        );
      }
    }
  });

  it("memoizes the response and invalidates on reset", () => {
    const first = getIntrospectedErdDomains();
    const second = getIntrospectedErdDomains();
    expect(first).toBe(second);

    resetIntrospectedErdCache();
    const third = getIntrospectedErdDomains();
    expect(third).not.toBe(first);
    expect(third.totalTables).toBe(first.totalTables);
  });
});
