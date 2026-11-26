import { describe, expect, it } from "vitest";
import { createStaticAssetMimeGuardPlugin } from "./staticAssetCacheGuard";

describe("createStaticAssetMimeGuardPlugin", () => {
  it("rejects caching HTML responses for module scripts and stylesheets", async () => {
    const plugin = createStaticAssetMimeGuardPlugin();
    const htmlResponse = new Response("<!doctype html><title>MMS</title>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    const result = await plugin.cacheWillUpdate({
      request: new Request("https://demo.mmsv2.aabtaab.com/assets/documentFavicon-DtYsNXzU.js"),
      response: htmlResponse,
    });
    expect(result).toBeNull();
  });

  it("allows caching valid JavaScript, CSS, and font responses with HTTP 200", async () => {
    const plugin = createStaticAssetMimeGuardPlugin();
    const jsResponse = new Response("export const ok = true;", {
      status: 200,
      headers: { "content-type": "application/javascript; charset=utf-8" },
    });

    const result = await plugin.cacheWillUpdate({
      request: new Request("https://demo.mmsv2.aabtaab.com/assets/documentFavicon-lYBTF-JN.js"),
      response: jsResponse,
    });
    expect(result).toBe(jsResponse);
  });

  it("rejects non-200 responses so 404/500 errors never enter mms-static-assets", async () => {
    const plugin = createStaticAssetMimeGuardPlugin();
    const notFound = new Response('{"type":"not_found"}', {
      status: 404,
      headers: { "content-type": "application/json" },
    });

    const result = await plugin.cacheWillUpdate({
      request: new Request("https://demo.mmsv2.aabtaab.com/assets/missing-chunk.js"),
      response: notFound,
    });
    expect(result).toBeNull();
  });
});
