/**
 * Tracer port for the data layer.
 *
 * `tenant-context` emits a `drizzle.transaction` span per transaction. The app's
 * telemetry implementation lives in the backend (`config/telemetry.ts`), so the
 * package exposes this port instead of importing it: the backend registers its
 * tracer at boot via `setDbTracer()`; otherwise spans are a no-op (behaviour is
 * identical, only observability is lost).
 */
export interface DbSpanAttributes {
  [key: string]: string | number | boolean | undefined | null;
}

export interface DbSpanTracer {
  withSpan<T>(
    name: string,
    attributes: DbSpanAttributes,
    fn: (span?: unknown) => Promise<T>,
    parentContext?: unknown,
  ): Promise<T>;
}

const noopTracer: DbSpanTracer = {
  withSpan: (_name, _attributes, fn) => fn(undefined),
};

let active: DbSpanTracer = noopTracer;

/** Register the application tracer (backend `config/telemetry.ts`). */
export function setDbTracer(tracer: DbSpanTracer): void {
  active = tracer;
}

/** Restore the no-op tracer (tests only). */
export function resetDbTracerForTesting(): void {
  active = noopTracer;
}

/** Facade used by the moved data-layer modules. */
export const tracer = {
  withSpan: <T>(
    name: string,
    attributes: DbSpanAttributes,
    fn: (span?: unknown) => Promise<T>,
    parentContext?: unknown,
  ): Promise<T> => active.withSpan(name, attributes, fn, parentContext),
};
