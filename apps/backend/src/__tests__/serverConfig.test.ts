import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { loadServerConfig, resetServerConfigCacheForTesting } from "../config/serverConfig.js";
import { setStaticAssetHeaders } from "../plugins/staticAssets.js";
import { SSE_STREAM_HEADERS } from "../lib/livePush.js";

// loadServerConfig() is memoized in production (it runs on every tenant
// transaction). These tests mutate the environment between assertions, so the
// cache has to be dropped for each one.
beforeEach(() => {
  resetServerConfigCacheForTesting();
});

describe("loadServerConfig proxy trust", () => {
  const previousTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (previousTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = previousTrustProxy;
    }
  });

  it("does not trust forwarding headers by default", () => {
    delete process.env.TRUST_PROXY;
    expect(loadServerConfig().trustProxy).toBe(false);
  });

  it("supports explicitly disabling proxy trust", () => {
    process.env.TRUST_PROXY = "false";
    expect(loadServerConfig().trustProxy).toBe(false);
  });

  it("accepts an explicit comma-separated trusted proxy list", () => {
    process.env.TRUST_PROXY = "127.0.0.1, 10.0.0.0/8";
    expect(loadServerConfig().trustProxy).toEqual(["127.0.0.1", "10.0.0.0/8"]);
  });

  it("rejects a trust-all configuration", () => {
    process.env.TRUST_PROXY = "true";
    expect(() => loadServerConfig()).toThrow("TRUST_PROXY=true is unsafe");
  });

  it("defaults to loopback proxies in production when TRUST_PROXY is unset", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevJwt = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "a-secure-production-jwt-secret-with-at-least-32-chars";
      delete process.env.TRUST_PROXY;
      expect(loadServerConfig().trustProxy).toEqual(["127.0.0.1", "::1"]);
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      process.env.JWT_SECRET = prevJwt;
    }
  });
});

describe("loadServerConfig PG tenant tx budgets", () => {
  const previous = {
    statement: process.env.PG_STATEMENT_TIMEOUT_MS,
    idle: process.env.PG_IDLE_IN_TX_TIMEOUT_MS,
    request: process.env.REQUEST_TIMEOUT_MS,
  };

  afterEach(() => {
    restoreEnv("PG_STATEMENT_TIMEOUT_MS", previous.statement);
    restoreEnv("PG_IDLE_IN_TX_TIMEOUT_MS", previous.idle);
    restoreEnv("REQUEST_TIMEOUT_MS", previous.request);
  });

  it("defaults statement and idle-in-tx timeouts under request timeout", () => {
    delete process.env.PG_STATEMENT_TIMEOUT_MS;
    delete process.env.PG_IDLE_IN_TX_TIMEOUT_MS;
    delete process.env.REQUEST_TIMEOUT_MS;
    const config = loadServerConfig();
    expect(config.pgStatementTimeoutMs).toBe(30_000);
    expect(config.pgIdleInTxTimeoutMs).toBe(15_000);
    expect(config.pgIdleInTxTimeoutMs).toBeLessThanOrEqual(config.pgStatementTimeoutMs);
    expect(config.pgStatementTimeoutMs).toBeLessThanOrEqual(config.requestTimeoutMs);
  });

  it("caps statement timeout by request timeout and idle by statement", () => {
    process.env.REQUEST_TIMEOUT_MS = "20000";
    process.env.PG_STATEMENT_TIMEOUT_MS = "60000";
    process.env.PG_IDLE_IN_TX_TIMEOUT_MS = "45000";
    const config = loadServerConfig();
    expect(config.requestTimeoutMs).toBe(20_000);
    expect(config.pgStatementTimeoutMs).toBe(20_000);
    expect(config.pgIdleInTxTimeoutMs).toBe(20_000);
  });

  it("rejects invalid or negative integer strings gracefully with defaults", () => {
    process.env.REQUEST_TIMEOUT_MS = "-500";
    process.env.PG_POOL_MAX = "abc";
    process.env.REQUEST_BODY_LIMIT_BYTES = "0";
    const config = loadServerConfig();
    expect(config.requestTimeoutMs).toBe(120_000);
    expect(config.pgPoolMax).toBe(20);
    expect(config.bodyLimit).toBe(1024 * 1024);
  });
});

describe("loadServerConfig database URL validation", () => {
  const previousDbUrl = process.env.DATABASE_URL;

  afterEach(() => {
    restoreEnv("DATABASE_URL", previousDbUrl);
  });

  it("accepts valid postgresql:// and postgres:// URLs", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/mms";
    expect(loadServerConfig().databaseUrl).toBe("postgresql://user:pass@localhost:5432/mms");

    // Config is memoized after the first load, so re-read the environment.
    resetServerConfigCacheForTesting();
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/mms";
    expect(loadServerConfig().databaseUrl).toBe("postgres://user:pass@localhost:5432/mms");
  });

  it("rejects non-postgres database URLs", () => {
    process.env.DATABASE_URL = "http://localhost:5432/mms";
    expect(() => loadServerConfig()).toThrow(
      "DATABASE_URL must start with postgres:// or postgresql://",
    );
  });
});

describe("loadServerConfig network and domain settings", () => {
  const previous = {
    port: process.env.PORT,
    host: process.env.HOST,
    appDomain: process.env.MMS_APP_DOMAIN,
    logLevel: process.env.LOG_LEVEL,
  };

  afterEach(() => {
    restoreEnv("PORT", previous.port);
    restoreEnv("HOST", previous.host);
    restoreEnv("MMS_APP_DOMAIN", previous.appDomain);
    restoreEnv("LOG_LEVEL", previous.logLevel);
  });

  it("exposes host, port, appDomain, and validates logLevel", () => {
    process.env.HOST = "127.0.0.1";
    process.env.PORT = "5002";
    process.env.MMS_APP_DOMAIN = "mms.example.com";
    process.env.LOG_LEVEL = "debug";

    const config = loadServerConfig();
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(5002);
    expect(config.appDomain).toBe("mms.example.com");
    expect(config.logLevel).toBe("debug");
  });
});

describe("Static asset edge caching and Content-Encoding strategy", () => {
  it("sets immutable 1-year cache headers on hashed js/css assets", () => {
    const headers: Record<string, string> = {};
    const mockReply = {
      header: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
    };

    setStaticAssetHeaders(mockReply, "/var/www/mms/dist/assets/vendor-react-BGBRuDhH.js");
    expect(headers["cache-control"]).toBe("public, max-age=31536000, immutable");

    const cssHeaders: Record<string, string> = {};
    const cssReply = {
      header: (k: string, v: string) => {
        cssHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(cssReply, "assets/index-B_Mi5IG9.css");
    expect(cssHeaders["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(cssHeaders["vary"]).toBe("Accept-Encoding");
  });

  it("sets revalidated caching headers on brand and root assets (favicon, logos, icons)", () => {
    const faviconHeaders: Record<string, string> = {};
    const faviconReply = {
      header: (k: string, v: string) => {
        faviconHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(faviconReply, "/dist/favicon.ico");
    expect(faviconHeaders["cache-control"]).toBe("public, max-age=86400, must-revalidate");
    expect(faviconHeaders["vary"]).toBe("Accept-Encoding");

    const svgHeaders: Record<string, string> = {};
    const svgReply = {
      header: (k: string, v: string) => {
        svgHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(svgReply, "/favicon.svg");
    expect(svgHeaders["cache-control"]).toBe("public, max-age=86400, must-revalidate");

    const logoHeaders: Record<string, string> = {};
    const logoReply = {
      header: (k: string, v: string) => {
        logoHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(logoReply, "/platform-logo.png");
    expect(logoHeaders["cache-control"]).toBe("public, max-age=86400, must-revalidate");

    const iconHeaders: Record<string, string> = {};
    const iconReply = {
      header: (k: string, v: string) => {
        iconHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(iconReply, "/icon-192.png");
    expect(iconHeaders["cache-control"]).toBe("public, max-age=86400, must-revalidate");
  });

  it("sets no-cache, no-store headers on entry files (index.html, site.webmanifest)", () => {
    const htmlHeaders: Record<string, string> = {};
    const htmlReply = {
      header: (k: string, v: string) => {
        htmlHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(htmlReply, "/dist/index.html");
    expect(htmlHeaders["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    expect(htmlHeaders["pragma"]).toBe("no-cache");
    expect(htmlHeaders["vary"]).toBe("Accept-Encoding");

    const manifestHeaders: Record<string, string> = {};
    const manifestReply = {
      header: (k: string, v: string) => {
        manifestHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(manifestReply, "/dist/site.webmanifest");
    expect(manifestHeaders["cache-control"]).toBe("no-cache, no-store, must-revalidate");
    expect(manifestHeaders["vary"]).toBe("Accept-Encoding");
  });

  it("sets download attachment headers for upload attachments and standard caching for others", () => {
    const attachHeaders: Record<string, string> = {};
    const attachReply = {
      header: (k: string, v: string) => {
        attachHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(attachReply, "/uploads/attachments/exam_results.pdf");
    expect(attachHeaders["content-type"]).toBe("application/octet-stream");
    expect(attachHeaders["content-disposition"]).toBe("attachment");

    const imageHeaders: Record<string, string> = {};
    const imageReply = {
      header: (k: string, v: string) => {
        imageHeaders[k.toLowerCase()] = v;
      },
    };
    setStaticAssetHeaders(imageReply, "/uploads/avatars/student_photo.webp");
    expect(imageHeaders["cache-control"]).toBe("public, max-age=86400");
    expect(imageHeaders["vary"]).toBe("Accept-Encoding");
  });

  it("exports zero-latency streaming SSE headers with unbuffered flags", () => {
    expect(SSE_STREAM_HEADERS["Content-Type"]).toBe("text/event-stream");
    expect(SSE_STREAM_HEADERS["Cache-Control"]).toBe("no-cache, no-transform");
    expect(SSE_STREAM_HEADERS["Connection"]).toBe("keep-alive");
    expect(SSE_STREAM_HEADERS["X-Accel-Buffering"]).toBe("no");
    expect(SSE_STREAM_HEADERS["Transfer-Encoding"]).toBe("chunked");
  });

  it("serves pre-compressed assets with Content-Encoding and Cache-Control via Fastify", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "mms-static-test-"));
    const assetsDir = join(tempDir, "assets");
    await mkdir(assetsDir, { recursive: true });

    const jsContent = Buffer.from('console.log("hello mms");'.repeat(50));
    const jsBr = brotliCompressSync(jsContent);
    const jsGz = gzipSync(jsContent);

    const htmlContent = Buffer.from("<!doctype html><html><body>MMS</body></html>");
    const htmlBr = brotliCompressSync(htmlContent);

    await writeFile(join(assetsDir, "vendor-react-BGBRuDhH.js"), jsContent);
    await writeFile(join(assetsDir, "vendor-react-BGBRuDhH.js.br"), jsBr);
    await writeFile(join(assetsDir, "vendor-react-BGBRuDhH.js.gz"), jsGz);

    await writeFile(join(tempDir, "index.html"), htmlContent);
    await writeFile(join(tempDir, "index.html.br"), htmlBr);

    const app = fastify();
    await app.register(fastifyStatic, {
      root: tempDir,
      prefix: "/",
      preCompressed: true,
      setHeaders: (res, path) => {
        setStaticAssetHeaders(res, path);
      },
    });
    await app.ready();

    try {
      // 1. Request with Accept-Encoding: br
      const brRes = await app.inject({
        method: "GET",
        url: "/assets/vendor-react-BGBRuDhH.js",
        headers: { "accept-encoding": "br, gzip" },
      });
      expect(brRes.statusCode).toBe(200);
      expect(brRes.headers["content-encoding"]).toBe("br");
      expect(brRes.headers["cache-control"]).toBe("public, max-age=31536000, immutable");

      // 2. Request with Accept-Encoding: gzip
      const gzRes = await app.inject({
        method: "GET",
        url: "/assets/vendor-react-BGBRuDhH.js",
        headers: { "accept-encoding": "gzip" },
      });
      expect(gzRes.statusCode).toBe(200);
      expect(gzRes.headers["content-encoding"]).toBe("gzip");
      expect(gzRes.headers["cache-control"]).toBe("public, max-age=31536000, immutable");

      // 3. Request index.html with Accept-Encoding: br
      const htmlRes = await app.inject({
        method: "GET",
        url: "/index.html",
        headers: { "accept-encoding": "br" },
      });
      expect(htmlRes.statusCode).toBe(200);
      expect(htmlRes.headers["content-encoding"]).toBe("br");
      expect(htmlRes.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");
      expect(htmlRes.headers["pragma"]).toBe("no-cache");
    } finally {
      await app.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
