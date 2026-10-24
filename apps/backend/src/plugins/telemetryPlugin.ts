import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { tracer, parseTraceParent, formatTraceParent, type Span } from "../config/telemetry.js";

declare module "fastify" {
  interface FastifyRequest {
    telemetrySpan?: Span;
    endTelemetrySpan?: (error?: unknown) => void;
  }
}

export function registerTelemetryPlugin(app: FastifyInstance): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const rawTraceParent = request.headers["traceparent"];
    const parentContext =
      typeof rawTraceParent === "string" ? parseTraceParent(rawTraceParent) : null;
    const routeUrl = request.routeOptions?.url || request.url;

    const { span, end } = tracer.startSpan(
      `HTTP ${request.method} ${routeUrl}`,
      {
        "http.method": request.method,
        "http.url": request.url,
        "http.route": routeUrl,
        "http.user_agent":
          typeof request.headers["user-agent"] === "string"
            ? request.headers["user-agent"]
            : undefined,
        "http.host":
          typeof request.headers["host"] === "string" ? request.headers["host"] : undefined,
      },
      parentContext ?? undefined,
    );

    request.telemetrySpan = span;
    request.endTelemetrySpan = end;

    reply.header("traceparent", formatTraceParent(span.context));
    reply.header("x-trace-id", span.context.traceId);
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.telemetrySpan && request.endTelemetrySpan) {
      request.telemetrySpan.attributes["http.status_code"] = reply.statusCode;
      if (reply.statusCode >= 500) {
        request.telemetrySpan.status = "error";
      }
      request.endTelemetrySpan();
    }
  });

  app.addHook("onError", async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    if (request.telemetrySpan && request.endTelemetrySpan) {
      request.telemetrySpan.attributes["error.name"] = error.name;
      request.telemetrySpan.attributes["error.message"] = error.message;
      request.endTelemetrySpan(error);
    }
  });
}
