import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ServerConfig } from "../config/serverConfig.js";
import {
  isNonSpaFallbackPath,
  registerWebApps,
  type WebAppsRootDirs,
} from "../plugins/registerWebApps.js";

function makeProdConfig(appDomain = "mmsv2.aabtaab.com"): ServerConfig {
  // registerWebApps only reads `isProd` and `appDomain`; keep the fixture minimal
  // so ServerConfig growth does not break this test.
  return { isProd: true, appDomain } as ServerConfig;
}

describe("registerWebApps static asset vs SPA fallback routing", () => {
  let rootTemp: string;
  let roots: WebAppsRootDirs;

  beforeEach(async () => {
    rootTemp = await mkdtemp(join(tmpdir(), "mms-webapps-test-"));
    roots = {
      platformDist: join(rootTemp, "platform-dist"),
      tenantDist: join(rootTemp, "tenant-dist"),
    };
    await mkdir(join(roots.platformDist, "assets"), { recursive: true });
    await mkdir(join(roots.tenantDist, "assets"), { recursive: true });

    await writeFile(
      join(roots.platformDist, "index.html"),
      "<!doctype html><title>Platform Shell</title>",
    );
    await writeFile(
      join(roots.platformDist, "assets", "index-CURRENT.js"),
      'console.log("platform");',
    );
    await writeFile(
      join(roots.platformDist, "sw.js"),
      "self.addEventListener('install', () => self.skipWaiting());",
    );

    await writeFile(
      join(roots.tenantDist, "index.html"),
      "<!doctype html><title>Tenant Shell</title>",
    );
    await writeFile(join(roots.tenantDist, "assets", "index-TENANT.js"), 'console.log("tenant");');
  });

  afterEach(async () => {
    await rm(rootTemp, { recursive: true, force: true });
  });

  it("classifies missing module scripts, service workers, and asset prefixes as non-SPA paths", () => {
    expect(isNonSpaFallbackPath("/assets/documentFavicon-DtYsNXzU.js")).toBe(true);
    expect(isNonSpaFallbackPath("/assets/index-OLD.css")).toBe(true);
    expect(isNonSpaFallbackPath("/assets")).toBe(true);
    expect(isNonSpaFallbackPath("/assets/")).toBe(true);
    expect(isNonSpaFallbackPath("/sw.js")).toBe(true);
    expect(isNonSpaFallbackPath("/workbox-1a2b3c4d.js")).toBe(true);
    expect(isNonSpaFallbackPath("/favicon.svg")).toBe(true);
    expect(isNonSpaFallbackPath("/platform-logo.webp")).toBe(true);
    expect(isNonSpaFallbackPath("/site.webmanifest")).toBe(true);
    expect(isNonSpaFallbackPath("/api/unknown")).toBe(true);
    expect(isNonSpaFallbackPath("/uploads/missing.png")).toBe(true);
    expect(isNonSpaFallbackPath("/health")).toBe(true);

    // Client-side SPA routes (including dotted slugs) still fall back to index.html
    expect(isNonSpaFallbackPath("/")).toBe(false);
    expect(isNonSpaFallbackPath("/platform/workspaces")).toBe(false);
    expect(isNonSpaFallbackPath("/students/st.john-academy")).toBe(false);
  });

  it("returns 404 (never 200 text/html) with Cache-Control: no-store for stale/missing JS chunks", async () => {
    const app = fastify();
    await registerWebApps(app, makeProdConfig(), roots);
    await app.ready();

    try {
      const apexStale = await app.inject({
        method: "GET",
        url: "/assets/documentFavicon-DtYsNXzU.js",
        headers: { host: "mmsv2.aabtaab.com" },
      });
      expect(apexStale.statusCode).toBe(404);
      expect(apexStale.headers["content-type"]).toContain("application/json");
      expect(apexStale.headers["cache-control"]).toBe("no-store");
      expect(apexStale.body).not.toContain("<!doctype html>");

      const tenantStale = await app.inject({
        method: "GET",
        url: "/assets/documentFavicon-DtYsNXzU.js",
        headers: { host: "demo.mmsv2.aabtaab.com" },
      });
      expect(tenantStale.statusCode).toBe(404);
      expect(tenantStale.headers["content-type"]).toContain("application/json");
      expect(tenantStale.headers["cache-control"]).toBe("no-store");
    } finally {
      await app.close();
    }
  });

  it("returns 404 for directory paths (/assets/) and missing root static files (/favicon.svg)", async () => {
    const app = fastify();
    await registerWebApps(app, makeProdConfig(), roots);
    await app.ready();

    try {
      const dirRes = await app.inject({
        method: "GET",
        url: "/assets/",
        headers: { host: "mmsv2.aabtaab.com" },
      });
      expect(dirRes.statusCode).toBe(404);

      const missingIcon = await app.inject({
        method: "GET",
        url: "/favicon.svg",
        headers: { host: "mmsv2.aabtaab.com" },
      });
      expect(missingIcon.statusCode).toBe(404);
      expect(missingIcon.headers["cache-control"]).toBe("no-store");
    } finally {
      await app.close();
    }
  });

  it("serves existing JS chunks, apex sw.js with JavaScript MIME + no-store, and SPA routes per host", async () => {
    const app = fastify();
    await registerWebApps(app, makeProdConfig(), roots);
    await app.ready();

    try {
      const jsRes = await app.inject({
        method: "GET",
        url: "/assets/index-CURRENT.js",
        headers: { host: "mmsv2.aabtaab.com" },
      });
      expect(jsRes.statusCode).toBe(200);
      expect(jsRes.headers["content-type"]).toMatch(/javascript/);
      expect(jsRes.headers["cache-control"]).toBe("public, max-age=31536000, immutable");

      const swRes = await app.inject({
        method: "GET",
        url: "/sw.js",
        headers: { host: "mmsv2.aabtaab.com" },
      });
      expect(swRes.statusCode).toBe(200);
      expect(swRes.headers["content-type"]).toMatch(/javascript/);
      expect(swRes.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate");

      const apexSpa = await app.inject({
        method: "GET",
        url: "/platform/workspaces",
        headers: { host: "mmsv2.aabtaab.com" },
      });
      expect(apexSpa.statusCode).toBe(200);
      expect(apexSpa.headers["content-type"]).toContain("text/html");
      expect(apexSpa.body).toContain("Platform Shell");

      const tenantSpa = await app.inject({
        method: "GET",
        url: "/students/st.john-academy",
        headers: { host: "demo.mmsv2.aabtaab.com" },
      });
      expect(tenantSpa.statusCode).toBe(200);
      expect(tenantSpa.headers["content-type"]).toContain("text/html");
      expect(tenantSpa.body).toContain("Tenant Shell");
    } finally {
      await app.close();
    }
  });

  it("rejects URL-encoded path traversal attempts without falling back to index.html", async () => {
    const app = fastify();
    await registerWebApps(app, makeProdConfig(), roots);
    await app.ready();

    try {
      const traversal = await app.inject({
        method: "GET",
        url: "/assets/%2e%2e/%2e%2e/package.json",
        headers: { host: "mmsv2.aabtaab.com" },
      });
      expect(traversal.statusCode).toBe(404);
      expect(traversal.headers["content-type"]).toContain("application/json");
    } finally {
      await app.close();
    }
  });
});
