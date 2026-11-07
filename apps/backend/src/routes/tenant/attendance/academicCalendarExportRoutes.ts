import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import {
  ATTENDANCE_MODULE_MANIFEST,
  academicCalendarExportQuerySchema,
  buildTenantExportFilename,
} from "@mms/shared";
import { buildContentDisposition } from "../../../lib/contentDisposition.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { getWorkspaceTimezone } from "../../../lib/workspaceTimezone.js";
import { canReadCollection } from "../../../services/rbacService.js";
import { academicCalendarUseCases } from "../../../attendance/use-cases/academicCalendarUseCases.js";
import {
  streamAcademicCalendarCsv,
  streamAcademicCalendarIcs,
} from "../../../attendance/use-cases/academicCalendarExport.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;
const MAX_RANGE_DAYS = 366;

function parseQuery(query: unknown) {
  const parsed = academicCalendarExportQuerySchema.safeParse(query ?? {});
  if (!parsed.success) return { ok: false as const };
  const from = Date.parse(`${parsed.data.from}T00:00:00.000Z`);
  const to = Date.parse(`${parsed.data.to}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return { ok: false as const };
  if ((to - from) / 86_400_000 + 1 > MAX_RANGE_DAYS) return { ok: false as const };
  return { ok: true as const, data: parsed.data };
}

/** Bounded, streamed academic-calendar exports (ICS + CSV). */
export const academicCalendarExportRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = async (
    request: { query: unknown; user?: unknown },
    reply: {
      header: (k: string, v: string) => unknown;
      status: (n: number) => { send: (b: unknown) => unknown };
      send: (b: unknown) => unknown;
    },
    format: "ics" | "csv",
  ) => {
    const user = request.user as { id?: string } | undefined;
    if (!user || !canReadCollection(user as never, COLLECTION))
      return reply.status(403).send({ type: "forbidden", message: "Insufficient permissions" });
    const tenant = getRequestTenant();
    if (!tenant) return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    const query = parseQuery(request.query);
    if (!query.ok)
      return reply.status(400).send({
        type: "validation_error",
        message: "from/to are required and the range must be at most 366 days",
      });

    const events = (
      await academicCalendarUseCases.list(tenant, {
        from: query.data.from,
        to: query.data.to,
        includeDeleted: false,
      })
    ).filter(
      (event) =>
        (!query.data.scope || event.scope === query.data.scope) &&
        (!query.data.sessionId || event.sessionId === query.data.sessionId) &&
        (!query.data.classId || event.classId === query.data.classId) &&
        (!query.data.sectionId || event.sectionId === query.data.sectionId),
    );

    const timeZone = await getWorkspaceTimezone(tenant);
    const filename = buildTenantExportFilename(
      "academic-calendar",
      `academic-calendar-${query.data.from}-${query.data.to}.${format}`,
    );
    const body =
      format === "ics"
        ? Readable.from(streamAcademicCalendarIcs(events, timeZone))
        : Readable.from(streamAcademicCalendarCsv(events));
    reply.header(
      "Content-Type",
      format === "ics" ? "text/calendar; charset=utf-8" : "text/csv; charset=utf-8",
    );
    reply.header("Content-Disposition", buildContentDisposition(filename));
    return reply.send(body);
  };

  fastify.get("/calendar/export.ics", async (request, reply) =>
    handler(request as never, reply as never, "ics"),
  );
  fastify.get("/calendar/export.csv", async (request, reply) =>
    handler(request as never, reply as never, "csv"),
  );
};
