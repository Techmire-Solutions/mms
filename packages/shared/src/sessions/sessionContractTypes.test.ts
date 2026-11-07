import { describe, expect, it } from "vitest";
import { SessionSchema, type Session } from "./sessionTypes.js";
import { sessionStatusFilterSchema, normalizeSessionStatusFilter } from "./sessionStatusFilter.js";
import { sessionsListQuerySchema, SESSION_SORT_FIELDS } from "./sessionsListQuery.js";
import { sessionWithTermsAndClassesSchema } from "./sessionCategories.js";
import { sessionResponseSchema } from "../contracts/sessionContractShared.js";
import { sessionImportRowSchema } from "../schemas/moduleImport.dto.js";
import {
  sessionsTransferSchema,
  type SessionTransferEntity,
} from "../dataTransfer/schemas/sessionsTransferSchema.js";

describe("canonical session contract types", () => {
  it("narrows status to the lifecycle union and normalizes legacy aliases", () => {
    expect(SessionSchema.parse({ id: "s1", name: "Hifz", status: "active" }).status).toBe(
      "in_progress",
    );
    expect(() => SessionSchema.parse({ id: "s1", name: "Hifz", status: "planning" })).toThrow();
    expect(() =>
      sessionResponseSchema.parse({ id: "s1", name: "Hifz", status: "unknown" }),
    ).toThrow();
  });

  it("requires ISO instants for audit timestamps and allows empty session dates", () => {
    expect(() =>
      SessionSchema.parse({ id: "s1", name: "Hifz", createdAt: "2026-01-01" }),
    ).toThrow();
    expect(
      SessionSchema.parse({
        id: "s1",
        name: "Hifz",
        createdAt: "2026-01-01T00:00:00.000Z",
        startDate: "",
        endDate: "",
      }),
    ).toMatchObject({ createdAt: "2026-01-01T00:00:00.000Z", startDate: "" });
  });

  it("validates the derived class/term composition", () => {
    const parsed = sessionWithTermsAndClassesSchema.parse({
      id: "s1",
      name: "Hifz 2026",
      classes: [{ id: "c1", name: "Class A" }],
      category: { id: "cat-1", name: "Term 1", code: "term", type: "term" },
      program: null,
    });
    expect(parsed.classes?.[0]?.name).toBe("Class A");
    expect(parsed.category?.type).toBe("term");
  });

  it("validates list status/sort filters", () => {
    expect(sessionsListQuerySchema.parse({ status: "active,in_progress" }).status).toBe(
      "active,in_progress",
    );
    expect(normalizeSessionStatusFilter("active,open")).toEqual(["in_progress", "open"]);
    expect(sessionStatusFilterSchema.safeParse("weird").success).toBe(false);
    expect(sessionsListQuerySchema.safeParse({ sortField: "bogus" }).success).toBe(false);
    expect(SESSION_SORT_FIELDS).toContain("startDate");
  });

  it("round-trips an exported session row through the import schema", () => {
    const entity = {
      name: "Hifz 2026",
      type: "Term",
      status: "active",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      baseFee: "1500",
      currency: "PKR",
      description: "Annual program",
    } as unknown as SessionTransferEntity;
    const row = Object.fromEntries(
      sessionsTransferSchema.fields.map((field) => [field.key, field.extract?.(entity)]),
    );
    const parsed = sessionImportRowSchema.parse(row);
    expect(parsed.status).toBe("in_progress");
    expect(parsed.startDate).toBe("2026-01-01");
  });

  it("keeps the public response shape aligned with the domain shape", () => {
    const domainKeys = Object.keys(SessionSchema.shape).sort();
    const responseKeys = Object.keys(sessionResponseSchema.shape).sort();
    expect(responseKeys).toEqual(
      domainKeys.filter((key) => !["overlapExempt", "deletedBy", "restoredBy"].includes(key)),
    );
    // Compile-time check: the domain type is inferred, not hand-written.
    const session = SessionSchema.parse({ id: "s1", name: "Hifz" }) satisfies Session;
    expect(session.id).toBe("s1");
  });
});
