import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { attendanceContractRouter } from "../routes/tenant/attendance/attendanceContractRouter.js";
import { ATTENDANCE_BULK_MAX_BYTES } from "@mms/shared";

/**
 * Payload bottleneck guard: an oversized roster save is refused with 413 **before parsing**.
 *
 * The 500-row Zod cap is semantic; this is the byte limit. The hook only inspects the declared
 * content-length, so the body is never buffered for a request that is already too large.
 */
function buildApp() {
  const app = Fastify({ logger: false });
  app.register(attendanceContractRouter);
  return app;
}

describe("PUT /api/attendance/bulk payload guard", () => {
  it("rejects a body above the byte ceiling with 413", async () => {
    const app = buildApp();
    // A single string field keeps the payload cheap to build; the guard runs on content-length.
    const body = JSON.stringify({
      records: [],
      padding: "x".repeat(ATTENDANCE_BULK_MAX_BYTES + 1),
    });
    const response = await app.inject({
      method: "PUT",
      url: "/api/attendance/bulk",
      headers: { "content-type": "application/json" },
      payload: body,
    });
    await app.close();

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ type: "payload_too_large" });
  });

  it("lets a body under the ceiling through to the handler", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/attendance/bulk",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ records: [] }),
    });
    await app.close();

    // No authenticated user → the handler refuses at the RBAC gate, i.e. the hook did not block it.
    expect(response.statusCode).not.toBe(413);
  });

  it("ignores other attendance routes", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "PUT",
      url: "/api/attendance/preferences",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        workingDays: ["mon"],
        padding: "x".repeat(ATTENDANCE_BULK_MAX_BYTES + 1),
      }),
    });
    await app.close();

    expect(response.statusCode).not.toBe(413);
  });
});
