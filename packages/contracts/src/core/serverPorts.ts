/** Canonical Fastify listen port on Hetzner (Apache upstream). */
export const MMS_PRODUCTION_BACKEND_PORT = 5002;

/** Dev-only backend port — never bind in production (`mms-production-ports`). */
export const MMS_DEV_BACKEND_PORT = 3000;

/** Local dev ports that must not be used on production hosts. */
export const MMS_PRODUCTION_FORBIDDEN_PORTS = [3000, 3001] as const;

export type MmsProductionForbiddenPort = (typeof MMS_PRODUCTION_FORBIDDEN_PORTS)[number];

/**
 * Resolves backend listen port; throws in production when PORT is a forbidden dev port.
 */
export function resolveBackendListenPort(env: { NODE_ENV?: string; PORT?: string }): number {
  const isProd = env.NODE_ENV === "production";
  const fallback = isProd ? MMS_PRODUCTION_BACKEND_PORT : MMS_DEV_BACKEND_PORT;
  const raw = env.PORT?.trim();
  const port = parseInt(raw && raw.length > 0 ? raw : String(fallback), 10);

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw ?? fallback}`);
  }

  if (isProd && (MMS_PRODUCTION_FORBIDDEN_PORTS as readonly number[]).includes(port)) {
    throw new Error(
      `Production must not listen on port ${port}. Set PORT=${MMS_PRODUCTION_BACKEND_PORT} (see mms-production-ports).`,
    );
  }

  return port;
}

/**
 * Returns an error message when a port is forbidden on production hosts, else null.
 */
export function productionPortViolation(port: number | string): string | null {
  const n = typeof port === "string" ? parseInt(port, 10) : port;
  if (!Number.isFinite(n)) return `Invalid port: ${port}`;
  if ((MMS_PRODUCTION_FORBIDDEN_PORTS as readonly number[]).includes(n)) {
    return `Production must not use port ${n}. Use ${MMS_PRODUCTION_BACKEND_PORT}.`;
  }
  return null;
}
