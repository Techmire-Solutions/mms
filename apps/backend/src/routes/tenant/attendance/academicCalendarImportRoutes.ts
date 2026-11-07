import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  ATTENDANCE_MODULE_MANIFEST,
  academicCalendarImportBodySchema,
  type User,
} from "@mms/shared";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
import { academicCalendarUseCases } from "../../../attendance/use-cases/academicCalendarUseCases.js";
import { HttpDomainError } from "../../../lib/httpErrors.js";

const MAX_ROWS = 500;

function rowId(tenant: string, index: number, body: unknown): string {
  return `imp-${createHash("sha256")
    .update(`${tenant}:${index}:${JSON.stringify(body)}`)
    .digest("hex")
    .slice(0, 24)}`;
}

/** Bulk academic-calendar event import with per-row validation/errors. */
export const academicCalendarImportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/calendar/import", async (request, reply) => {
    const user = request.user as User;
    if (!userHasPermission(user, ATTENDANCE_MODULE_MANIFEST.permissions.setupWrite))
      return reply.status(403).send({ type: "forbidden", message: "Insufficient permissions" });
    const parsed = academicCalendarImportBodySchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({
        type: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid rows",
      });
    if (parsed.data.rows.length > MAX_ROWS)
      return reply
        .status(400)
        .send({ type: "validation_error", message: `At most ${MAX_ROWS} rows` });

    const tenant = String(request.tenant?.id ?? "");
    const errors: Array<{ row: number; reason: string }> = [];
    let imported = 0;

    for (let index = 0; index < parsed.data.rows.length; index += 1) {
      const row = parsed.data.rows[index];
      if (parsed.data.dryRun) {
        imported += 1;
        continue;
      }
      try {
        await academicCalendarUseCases.save(
          tenant,
          row.id || rowId(tenant, index, row),
          row,
          user.id,
        );
        imported += 1;
      } catch (error) {
        const reason =
          error instanceof HttpDomainError
            ? error.message
            : error instanceof Error
              ? error.message.slice(0, 300)
              : "Invalid row";
        errors.push({ row: index + 1, reason });
      }
    }

    return reply.status(200).send({
      ...(parsed.data.dryRun ? { dryRun: true } : {}),
      imported,
      failed: errors.length,
      total: parsed.data.rows.length,
      errors,
    });
  });
};
