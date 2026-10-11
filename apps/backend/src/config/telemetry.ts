import { randomBytes } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "../lib/logger.js";

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined | null;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: string;
}

export interface Span {
  name: string;
  context: SpanContext;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: SpanAttributes;
  status: "ok" | "error" | "unset";
  error?: Error | string;
}

// AsyncLocalStorage for context propagation
const traceStorage = new AsyncLocalStorage<SpanContext>();

export function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

export function generateSpanId(): string {
  return randomBytes(8).toString("hex");
}

export function parseTraceParent(header?: string | null): SpanContext | null {
  if (!header || typeof header !== "string") return null;
  const parts = header.trim().split("-");
  if (parts.length < 4) return null;
  const [version, traceId, parentSpanId, traceFlags] = parts;
  if (version !== "00" || traceId.length !== 32 || parentSpanId.length !== 16) {
    return null;
  }
  return {
    traceId,
    spanId: generateSpanId(),
    parentSpanId,
    traceFlags: traceFlags || "01",
  };
}

export function formatTraceParent(context: SpanContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
}

export function getCurrentSpanContext(): SpanContext | undefined {
  return traceStorage.getStore();
}

export class TelemetryTracer {
  private serviceName: string;
  private isEnabled: boolean;

  constructor(serviceName = "mms-backend") {
    this.serviceName = serviceName;
    this.isEnabled =
      process.env.ENABLE_OTEL_TRACING === "true" || process.env.NODE_ENV === "production";
  }

  public startSpan(
    name: string,
    attributes: SpanAttributes = {},
    parentContext?: SpanContext,
  ): { span: Span; end: (error?: unknown) => void } {
    const parent = parentContext ?? getCurrentSpanContext();
    const traceId = parent ? parent.traceId : generateTraceId();
    const spanId = generateSpanId();
    const parentSpanId = parent ? parent.spanId : undefined;
    const traceFlags = parent ? parent.traceFlags : "01";

    const span: Span = {
      name,
      context: { traceId, spanId, parentSpanId, traceFlags },
      startTime: Date.now(),
      attributes: {
        "service.name": this.serviceName,
        ...attributes,
      },
      status: "unset",
    };

    const end = (error?: unknown) => {
      span.endTime = Date.now();
      span.durationMs = span.endTime - span.startTime;
      if (error) {
        span.status = "error";
        span.error = error instanceof Error ? error.message : String(error);
      } else if (span.status === "unset") {
        span.status = "ok";
      }

      if (this.isEnabled && process.env.DEBUG_OTEL === "true") {
        logger.debug(
          {
            traceId: span.context.traceId,
            spanId: span.context.spanId,
            durationMs: span.durationMs,
            status: span.status,
          },
          `[Trace] ${span.name}`,
        );
      }
    };

    return { span, end };
  }

  public async withSpan<T>(
    name: string,
    attributes: SpanAttributes,
    fn: (span: Span) => Promise<T>,
    parentContext?: SpanContext,
  ): Promise<T> {
    const { span, end } = this.startSpan(name, attributes, parentContext);
    return traceStorage.run(span.context, async () => {
      try {
        const result = await fn(span);
        end();
        return result;
      } catch (err) {
        end(err);
        throw err;
      }
    });
  }
}

export const tracer = new TelemetryTracer(process.env.OTEL_SERVICE_NAME || "mms-backend");
