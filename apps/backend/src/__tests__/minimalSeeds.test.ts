import { describe, expect, it } from "vitest";
import { getMinimalCollectionsForSeed, getMinimalObjects } from "../db/minimalSeeds.js";

const TENANT_RECORD_COLLECTIONS = [
  "contacts",
  "students",
  "enrollments",
  "sessions",
  "attendance_records",
  "finance_invoices",
  "finance_payments",
  "hasanat_distributions",
  "exams",
  "exam_results",
  "users",
  "user_activity_logs",
  "accounting_accounts",
  "accounting_entries",
  "questions",
  "tests",
  "assessment_results",
] as const;

describe("minimal workspace seeds", () => {
  it("starts every tenant-owned record collection empty", async () => {
    const collections = await getMinimalCollectionsForSeed();

    for (const name of TENANT_RECORD_COLLECTIONS) {
      expect(collections[name], name).toEqual([]);
    }
  });

  it("contains configuration only and no fabricated notifications or identity data", () => {
    const objects = getMinimalObjects();
    const serialized = JSON.stringify(objects);

    expect(objects).not.toHaveProperty("dashboard_notifications");
    expect(objects.socialPlaceholders).toEqual({});
    expect(serialized).not.toMatch(/Ahmed Ali|Fatima Zahra|Islamic Street|info@madrasa\.edu\.pk/);
  });
});
