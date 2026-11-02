import { describe, expect, it, vi } from "vitest";
import {
  guardContactSoftDeleteDependents,
  guardStudentSoftDelete,
} from "../db/repositories/studentDeleteGuard.js";

/**
 * The contact guard runs one query per dependency kind (students → faculty
 * employments → tenant users), so the fake counts calls to decide which link
 * blocks.
 */
vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: vi.fn(async (tenant: string, cb: (tx: unknown) => unknown) => {
    let call = 0;
    return cb({
      execute: async () => {
        call += 1;
        if (tenant === "has-unpaid-invoices" || tenant === "has-active-students") {
          return { rows: [{ id: "match-1" }] };
        }
        if (tenant === "has-active-faculty") {
          return { rows: call >= 2 ? [{ id: "match-1" }] : [] };
        }
        if (tenant === "has-active-user") {
          return { rows: call >= 3 ? [{ id: "match-1" }] : [] };
        }
        return { rows: [] };
      },
    });
  }),
}));

describe("guardStudentSoftDelete", () => {
  it("does nothing when id list is empty", async () => {
    await expect(guardStudentSoftDelete("demo", [])).resolves.toBeUndefined();
  });

  it("permits soft delete when no active unpaid invoices exist", async () => {
    await expect(guardStudentSoftDelete("clean-tenant", ["s-1"])).resolves.toBeUndefined();
  });

  it("throws 409 ConflictError when active unpaid invoices exist", async () => {
    await expect(guardStudentSoftDelete("has-unpaid-invoices", ["s-1"])).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Cannot delete student with active unpaid invoices"),
    });
  });
});

describe("guardContactSoftDeleteDependents", () => {
  it("does nothing when id list is empty", async () => {
    await expect(guardContactSoftDeleteDependents("demo", [])).resolves.toBeUndefined();
  });

  it("permits soft delete when no active person record links to the contact", async () => {
    await expect(
      guardContactSoftDeleteDependents("clean-tenant", ["c-1"]),
    ).resolves.toBeUndefined();
  });

  it("throws 409 ConflictError when the contact is linked to an active student", async () => {
    await expect(
      guardContactSoftDeleteDependents("has-active-students", ["c-1"]),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Cannot delete contact linked to active student profiles"),
    });
  });

  it("throws 409 ConflictError when the contact backs an active faculty employment", async () => {
    await expect(
      guardContactSoftDeleteDependents("has-active-faculty", ["c-1"]),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("active faculty employment"),
    });
  });

  it("throws 409 ConflictError when the contact backs an active staff user", async () => {
    await expect(
      guardContactSoftDeleteDependents("has-active-user", ["c-1"]),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("active staff user"),
    });
  });
});
