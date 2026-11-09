import { describe, expect, it } from "vitest";
import { attendanceContract } from "@mms/shared";

/** Flat route table (the contract is a single `c.router`, so each entry is a route). */
const attendanceContractRoutes = Object.fromEntries(
  Object.entries(attendanceContract).filter(
    ([, value]) => typeof value === "object" && value !== null && "method" in value,
  ),
) as unknown as Record<
  string,
  {
    method: string;
    path: string;
    pathParams?: { shape?: Record<string, unknown> };
    query?: unknown;
    body?: unknown;
    responses: Record<string, unknown>;
  }
>;

/**
 * Route-schema coverage.
 *
 * The brief's first requirement is that **every** route declares strict request and response
 * schemas. Nine attendance routes previously had no `pathParams`, the list query was a passthrough,
 * `getLookupKind` answered `z.unknown()`, and the metrics route had no response schema at all.
 */

const PATTERN_PARAM = /:([A-Za-z][A-Za-z0-9_]*)/g;

function paramsInPath(path: string): string[] {
  return [...path.matchAll(PATTERN_PARAM)].map((match) => match[1] as string);
}

describe("attendance contract — path params", () => {
  it.each(Object.entries(attendanceContractRoutes).map(([key, route]) => [key, route] as const))(
    "%s declares pathParams exactly when its path has parameters",
    (_key, route) => {
      const declared = paramsInPath(route.path);
      const pathParams = (route as { pathParams?: { shape?: Record<string, unknown> } }).pathParams;
      if (declared.length === 0) {
        expect(pathParams).toBeUndefined();
        return;
      }
      expect(pathParams, `${route.path} must declare pathParams`).toBeDefined();
      expect(Object.keys(pathParams?.shape ?? {}).sort()).toEqual([...declared].sort());
    },
  );

  it("bounds every path param to 64 characters or an enum", () => {
    for (const [, route] of Object.entries(attendanceContractRoutes)) {
      const shape = (route as { pathParams?: { shape?: Record<string, unknown> } }).pathParams
        ?.shape;
      if (!shape) continue;
      for (const [name, schema] of Object.entries(shape)) {
        const parsed = schema as {
          safeParse: (value: unknown) => { success: boolean };
          _def?: { typeName?: string; checks?: unknown[] };
        };
        // An over-long id must be rejected; an enum rejects by definition.
        if (parsed._def?.typeName === "ZodEnum") continue;
        expect(parsed.safeParse("x".repeat(65)).success, `${name} is unbounded`).toBe(false);
        // Param-specific valid samples: a calendar day, a lookup kind, or a bounded key.
        const lower = name.toLowerCase();
        const valid = lower.includes("date")
          ? "2026-03-02"
          : lower === "kind"
            ? "statuses"
            : "valid-id";
        expect(parsed.safeParse(valid).success, `${name} rejects a valid value`).toBe(true);
      }
    }
  });
});

describe("attendance contract — responses", () => {
  it("never declares a success response as unconstrained `unknown`", () => {
    for (const [key, route] of Object.entries(attendanceContractRoutes)) {
      const responses = route.responses as Record<string, { _def?: { typeName?: string } }>;
      // `submitLeave` answers 201, the scan answers 202; every success code must be typed.
      const okKey = Object.keys(responses).find((status) => /^20[0-2]$/.test(status));
      expect(okKey, `${key} has no success schema`).toBeDefined();
      // `ZodUnknown` is what `getLookupKind` used to return.
      expect(responses[okKey!]?._def?.typeName, `${key} returns an unconstrained success`).not.toBe(
        "ZodUnknown",
      );
    }
  });

  it("declares the conflict/validation statuses the write handlers can emit", () => {
    const required: Record<string, number[]> = {
      create: [400, 409, 422],
      bulk: [400, 409, 413, 422],
      update: [400, 409, 422],
      delete: [400, 409],
      restore: [400, 409],
    };
    for (const [key, statuses] of Object.entries(required)) {
      const declared = Object.keys(attendanceContractRoutes[key]?.responses ?? {}).map(Number);
      for (const status of statuses) {
        expect(declared, `${key} must declare ${status}`).toContain(status);
      }
    }
  });

  it("types the paginated list envelope including the keyset cursor", () => {
    const schema = attendanceContract.list.responses[200] as unknown as {
      shape?: Record<string, unknown>;
    };
    expect(Object.keys(schema.shape ?? {})).toContain("nextCursor");
    expect(Object.keys(schema.shape ?? {})).toContain("hasMore");
  });
});

describe("attendance contract — request strictness", () => {
  it("rejects unknown list query keys", () => {
    const query = attendanceContract.list.query as unknown as {
      safeParse: (value: unknown) => { success: boolean };
    };
    expect(query.safeParse({ classId: "cls-1", sectionId: "sec-a" }).success).toBe(true);
    expect(query.safeParse({ classId: "cls-1", bogus: "1" }).success).toBe(false);
    expect(query.safeParse({ sortField: "notAField" }).success).toBe(false);
    expect(query.safeParse({ limit: 500 }).success).toBe(false);
    expect(query.safeParse({ dateFrom: "2026-03-05", dateTo: "2026-03-01" }).success).toBe(false);
  });

  it("bounds the bulk body at the documented row cap and rejects unknown record keys", () => {
    const body = attendanceContract.bulk.body as unknown as {
      safeParse: (value: unknown) => { success: boolean };
    };
    const row = {
      id: "att-1",
      classId: "cls-1",
      studentId: "std-1",
      studentName: "Amina",
      rollNo: "1",
      date: "2026-03-02",
      status: "present",
      timeIn: "07:00",
      timeOut: "08:30",
      notes: "",
    };
    expect(body.safeParse({ records: [row] }).success).toBe(true);
    // `customFields` has no storage and is no longer part of the wire shape.
    expect(body.safeParse({ records: [{ ...row, customFields: { a: 1 } }] }).success).toBe(false);
    const tooMany = Array.from({ length: 501 }, (_, index) => ({
      ...row,
      studentId: `s-${index}`,
    }));
    expect(body.safeParse({ records: tooMany }).success).toBe(false);
  });

  it("keeps the roster query strict and requires the class and day", () => {
    const query = attendanceContract.getRoster.query as unknown as {
      safeParse: (value: unknown) => { success: boolean };
    };
    expect(query.safeParse({ classId: "cls-1", date: "2026-03-02" }).success).toBe(true);
    expect(query.safeParse({ classId: "cls-1" }).success).toBe(false);
    expect(query.safeParse({ classId: "cls-1", date: "2026-13-45" }).success).toBe(false);
    expect(query.safeParse({ classId: "cls-1", date: "2026-03-02", page: 2 }).success).toBe(false);
  });

  it("requires a justification to archive a mark but not to restore one", () => {
    const del = attendanceContractRoutes.delete!.body as unknown as {
      safeParse: (value: unknown) => { success: boolean };
    };
    const restore = attendanceContractRoutes.restore!.body as unknown as {
      safeParse: (value: unknown) => { success: boolean };
    };
    expect(del.safeParse({}).success).toBe(false);
    expect(del.safeParse({ deletionReason: "x" }).success).toBe(false);
    expect(del.safeParse({ deletionReason: "Duplicate mark from an import" }).success).toBe(true);
    // Restore is not a destructive act; it must not demand a reason.
    expect(restore.safeParse({}).success).toBe(true);
  });

  it("accepts one batch justification and rejects a too-short one", () => {
    const body = attendanceContract.bulk.body as unknown as {
      safeParse: (value: unknown) => { success: boolean };
    };
    const row = {
      id: "att-1",
      classId: "cls-1",
      studentId: "std-1",
      studentName: "Amina",
      rollNo: "1",
      date: "2026-03-02",
      status: "present",
      timeIn: "07:00",
      timeOut: "08:30",
      notes: "",
    };
    expect(body.safeParse({ records: [row], overrideReason: "Late medical note" }).success).toBe(
      true,
    );
    expect(body.safeParse({ records: [row], overrideReason: "ab" }).success).toBe(false);
  });

  it("rejects an attachment reference that is not a tenant attachment path", () => {
    const submit = attendanceContract.submitLeave.body as unknown as {
      safeParse: (value: unknown) => { success: boolean };
    };
    const base = {
      studentId: "std-1",
      fromDate: "2026-03-02",
      toDate: "2026-03-03",
      reason: "Fever",
      leaveType: "medical",
      notes: "",
    };
    expect(
      submit.safeParse({
        ...base,
        documentRef: "/uploads/tenants/demo/attachments/cert.pdf",
      }).success,
    ).toBe(true);
    expect(
      submit.safeParse({ ...base, documentRef: "https://evil.example/cert.pdf" }).success,
    ).toBe(false);
  });
});
