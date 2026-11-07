import { Readable } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import {
  SESSIONS_MODULE_MANIFEST,
  buildTenantExportFilename,
  sessionsTimetableExportQuerySchema,
} from "@mms/shared";
import { buildContentDisposition } from "../../../lib/contentDisposition.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { getWorkspaceTimezone } from "../../../lib/workspaceTimezone.js";
import { canReadCollection } from "../../../services/rbacService.js";
import { sessionsUseCases } from "../../../sessions/use-cases/sessionsUseCases.js";
import {
  streamTimetableCsv,
  streamTimetableIcs,
} from "../../../sessions/use-cases/sessionTimetableExport.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;

function parseQuery(query: unknown) {
  const parsed = sessionsTimetableExportQuerySchema.safeParse(query ?? {});
  return parsed.success ? { ok: true as const, data: parsed.data } : { ok: false as const };
}

/** Direct (streamed) class-timetable downloads for a session. */
export const sessionCalendarExportRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = async (
    request: { params: unknown; query: unknown; user?: unknown },
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
    const { id } = request.params as { id: string };
    const query = parseQuery(request.query);
    if (!query.ok)
      return reply.status(400).send({ type: "validation_error", message: "Invalid export query" });
    const [session] = await sessionsUseCases.loadSessionsByIds([id]);
    if (!session)
      return reply.status(404).send({ type: "not_found", message: "Session not found" });

    const timeZone = await getWorkspaceTimezone(tenant);
    const filename = buildTenantExportFilename(
      session.name,
      `session-${session.id}-timetable.${format}`,
    );
    const body =
      format === "ics"
        ? Readable.from(streamTimetableIcs(session as never, { ...query.data, timeZone }))
        : Readable.from(streamTimetableCsv(session as never, { ...query.data, timeZone }));

    reply.header(
      "Content-Type",
      format === "ics" ? "text/calendar; charset=utf-8" : "text/csv; charset=utf-8",
    );
    reply.header("Content-Disposition", buildContentDisposition(filename));
    return reply.send(body);
  };

  fastify.get("/:id/timetable.ics", async (request, reply) =>
    handler(request as never, reply as never, "ics"),
  );
  fastify.get("/:id/timetable.csv", async (request, reply) =>
    handler(request as never, reply as never, "csv"),
  );
};
