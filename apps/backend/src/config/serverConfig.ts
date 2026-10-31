import { resolveBackendListenPort } from "@mms/shared";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";

export interface ServerConfig {
  port: number;
  host: string;
  appDomain?: string;
  isProd: boolean;
  jwtSecret: string;
  databaseUrl: string;
  readReplicaDatabaseUrl: string;
  trustProxy: boolean | string[];
  logLevel: LogLevel;
  allowedOrigin: string;
  bodyLimit: number;
  requestTimeoutMs: number;
  pgPoolMax: number;
  /** Tenant-bound SET LOCAL statement_timeout (ms). Capped by requestTimeoutMs. */
  pgStatementTimeoutMs: number;
  /** Tenant-bound SET LOCAL idle_in_transaction_session_timeout (ms). Capped by statement timeout. */
  pgIdleInTxTimeoutMs: number;
  /** Node.js HTTP server socket keep-alive timeout (ms). Defaults to 30s to coordinate with Apache. */
  keepAliveTimeoutMs: number;
  /** Node.js HTTP server headers timeout (ms). Must exceed keepAliveTimeoutMs. */
  headersTimeoutMs: number;
  /** TCP Keep-Alive initial delay (ms) on accepted client sockets. */
  tcpKeepAliveInitialDelayMs: number;
  /** Exchange-rate feed providers the worker polls daily (`FX_RATE_FEED_PROVIDERS`); empty = off. */
  fxRateFeedProviders?: string[];
}

const VALID_LOG_LEVELS = new Set<LogLevel>([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

function parsePositiveInt(
  val: string | undefined,
  defaultVal: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!val) return defaultVal;
  const num = Number(val);
  if (!Number.isFinite(num) || num < min) return defaultVal;
  return Math.min(num, max);
}

function validatePostgresUrl(url: string, envVarName: string): void {
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error(`${envVarName} must start with postgres:// or postgresql://`);
  }
}

/**
 * Memoized server config.
 *
 * `loadServerConfig()` is called on every tenant transaction
 * (`applyTenantTransactionGuards`), so building it fresh meant re-reading and
 * re-validating the whole environment on the hottest path in the system. The
 * config is immutable after boot, so compute it once.
 *
 * Test-only env mutations must call {@link resetServerConfigCacheForTesting}.
 */
let cachedServerConfig: ServerConfig | null = null;

export function resetServerConfigCacheForTesting(): void {
  cachedServerConfig = null;
}

export function loadServerConfig(): ServerConfig {
  return (cachedServerConfig ??= buildServerConfig());
}

function buildServerConfig(): ServerConfig {
  const isProd = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

  let port: number;
  try {
    port = resolveBackendListenPort(process.env);
  } catch (err) {
    if (isTest) {
      port = isProd ? 5002 : 3000;
    } else {
      throw err;
    }
  }
  const host = process.env.HOST || "0.0.0.0";
  const appDomain = process.env.MMS_APP_DOMAIN?.trim() || undefined;

  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (isTest) {
      jwtSecret = "test-secret-at-least-32-characters-long";
    } else {
      throw new Error(
        "JWT_SECRET environment variable is required but not set. " +
          "Set it in your .env file or deployment environment before starting the server.",
      );
    }
  }
  if (isProd) {
    if (jwtSecret.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters in production");
    }
    const BANNED_SECRETS = [
      "change-me",
      "dev-local-change-me",
      "secret",
      "12345678901234567890123456789012",
    ];
    if (BANNED_SECRETS.includes(jwtSecret)) {
      throw new Error(
        "JWT_SECRET uses a known weak or default placeholder. Set a high-entropy secret key in production.",
      );
    }
  }

  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (isTest) {
      databaseUrl = "postgres://postgres:postgres@localhost:5432/mms";
    } else {
      throw new Error(
        "DATABASE_URL environment variable is required but not set. " +
          "Set it in your .env file or deployment environment before starting the server.",
      );
    }
  }
  validatePostgresUrl(databaseUrl, "DATABASE_URL");

  const readReplicaDatabaseUrl = process.env.READ_REPLICA_DATABASE_URL || databaseUrl;
  validatePostgresUrl(readReplicaDatabaseUrl, "READ_REPLICA_DATABASE_URL");

  const trustProxyValue = process.env.TRUST_PROXY?.trim();
  if (trustProxyValue === "true") {
    throw new Error(
      "TRUST_PROXY=true is unsafe. Set TRUST_PROXY to a comma-separated list of trusted proxy IPs or CIDR ranges.",
    );
  }
  const trustedProxies =
    trustProxyValue && trustProxyValue !== "false"
      ? trustProxyValue
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : isProd && trustProxyValue === undefined
        ? ["127.0.0.1", "::1"]
        : [];

  const rawLogLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  const logLevel: LogLevel =
    rawLogLevel && VALID_LOG_LEVELS.has(rawLogLevel) ? rawLogLevel : isTest ? "warn" : "info";

  const requestTimeoutMs = parsePositiveInt(
    process.env.REQUEST_TIMEOUT_MS,
    120_000,
    1_000,
    600_000,
  );
  const pgStatementTimeoutMs = Math.min(
    parsePositiveInt(process.env.PG_STATEMENT_TIMEOUT_MS, 30_000, 1, 600_000),
    requestTimeoutMs,
  );
  const pgIdleInTxTimeoutMs = Math.min(
    parsePositiveInt(process.env.PG_IDLE_IN_TX_TIMEOUT_MS, 15_000, 1, 600_000),
    pgStatementTimeoutMs,
  );

  return {
    port,
    host,
    appDomain,
    isProd,
    jwtSecret,
    databaseUrl,
    readReplicaDatabaseUrl,
    trustProxy: trustedProxies.length > 0 ? trustedProxies : false,
    logLevel,
    // In production never silently fall back to a localhost origin: prefer the
    // configured app domain so CORS is scoped to the real site.
    allowedOrigin:
      process.env.ALLOWED_ORIGIN ||
      (isProd && appDomain ? `https://${appDomain}` : "http://localhost:5173"),
    bodyLimit: parsePositiveInt(
      process.env.REQUEST_BODY_LIMIT_BYTES,
      1024 * 1024,
      1024,
      50 * 1024 * 1024,
    ),
    requestTimeoutMs,
    pgPoolMax: parsePositiveInt(process.env.PG_POOL_MAX, 20, 1, 100),
    pgStatementTimeoutMs,
    pgIdleInTxTimeoutMs,
    keepAliveTimeoutMs: parsePositiveInt(process.env.KEEP_ALIVE_TIMEOUT_MS, 30_000, 1_000, 300_000),
    headersTimeoutMs: parsePositiveInt(process.env.HEADERS_TIMEOUT_MS, 35_000, 1_000, 300_000),
    tcpKeepAliveInitialDelayMs: parsePositiveInt(
      process.env.TCP_KEEP_ALIVE_DELAY_MS,
      10_000,
      1_000,
      60_000,
    ),
    fxRateFeedProviders: (process.env.FX_RATE_FEED_PROVIDERS ?? "")
      .split(",")
      .map((provider) => provider.trim().toLowerCase())
      .filter(Boolean),
  };
}
