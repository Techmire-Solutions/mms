import { describe, expect, it, vi } from "vitest";
import {
  guardStudentSoftDelete,
  guardContactSoftDeleteForStudents,
} from "../db/repositories/studentDeleteGuard.js";

vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: vi.fn(async (tenant: string, cb: (tx: unknown) => unknown) => {
    return cb({
      execute: async () => {
        if (tenant === "has-unpaid-invoices" || tenant === "has-active-students") {
          return { rows: [{ id: "match-1" }] };
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

describe("guardContactSoftDeleteForStudents", () => {
  it("does nothing when id list is empty", async () => {
    await expect(guardContactSoftDeleteForStudents("demo", [])).resolves.toBeUndefined();
  });

  it("permits soft delete when no active students link to contact", async () => {
    await expect(
      guardContactSoftDeleteForStudents("clean-tenant", ["c-1"]),
    ).resolves.toBeUndefined();
  });

  it("throws 409 ConflictError when contact is linked to active student", async () => {
    await expect(
      guardContactSoftDeleteForStudents("has-active-students", ["c-1"]),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Cannot delete contact linked to active student profiles"),
    });
  });
});
