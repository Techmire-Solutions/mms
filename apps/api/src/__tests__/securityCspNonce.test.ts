import { afterEach, describe, expect, it } from "vitest";
import fastify from "fastify";
import { gzipSync, gunzipSync } from "node:zlib";
import { registerSecurityPlugins } from "../plugins/security.js";
import compress from "@fastify/compress";

describe("CSP Nonce injection & Content-Encoding safety", () => {
  const apps: ReturnType<typeof fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("injects nonce into uncompressed html and compresses cleanly with @fastify/compress", async () => {
    const app = fastify({ logger: false });
    apps.push(app);

    await registerSecurityPlugins(app);
    await app.register(compress, { global: true, threshold: 10 });

    app.get("/test-html", async (_req, reply) => {
      reply.header("content-type", "text/html; charset=utf-8");
      return '<!doctype html><html><head><script src="/theme-init.js"></script><script>console.log("inline");</script></head><body>Hello</body></html>';
    });

    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/test-html",
      headers: { "accept-encoding": "gzip" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");

    // Decompress the response body to ensure no binary corruption occurred
    const decompressed = gunzipSync(res.rawPayload).toString("utf8");
    expect(decompressed).toContain('nonce="');
    expect(decompressed).toContain('console.log("inline")');
  });

  it("does not corrupt already-compressed binary payloads if Content-Encoding is set", async () => {
    const app = fastify({ logger: false });
    apps.push(app);

    await registerSecurityPlugins(app);

    const originalHtml = "<!doctype html><html><body><h1>Pre-compressed</h1></body></html>";
    const compressedGzip = gzipSync(Buffer.from(originalHtml));

    app.get("/precompressed-html", async (_req, reply) => {
      reply.header("content-type", "text/html; charset=utf-8");
      reply.header("content-encoding", "gzip");
      return compressedGzip;
    });

    await app.ready();

    const res = await app.inject({
      method: "GET",
      url: "/precompressed-html",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");

    // Must be valid gzip without unicode replacement characters (0xEF 0xBF 0xBD)
    const decompressed = gunzipSync(res.rawPayload).toString("utf8");
    expect(decompressed).toBe(originalHtml);
  });
});
