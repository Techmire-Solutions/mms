import { describe, expect, it } from "vitest";
import {
  isPublicUploadPath,
  setStaticAssetHeaders,
  tenantSegmentOf,
  uploadPathFromUrl,
} from "../plugins/staticAssets.js";

/**
 * `/uploads/*` used to be served by a bare `@fastify/static` registration —
 * no auth, `Cache-Control: public`, and exempt from rate limiting — so a leaked
 * export URL was downloadable by anyone. These tests pin the classification the
 * auth hook relies on.
 */
describe("upload path parsing", () => {
  it("strips the prefix, query string and leading slashes", () => {
    expect(uploadPathFromUrl("/uploads/tenants/demo/exports/a.csv?x=1")).toBe(
      "tenants/demo/exports/a.csv",
    );
    expect(uploadPathFromUrl("/uploads//branding/logo.webp")).toBe("branding/logo.webp");
  });

  it("decodes percent-encoding before classification", () => {
    expect(uploadPathFromUrl("/uploads/tenants/de%6Do/exports/a.csv")).toBe(
      "tenants/demo/exports/a.csv",
    );
  });

  it("rejects traversal attempts", () => {
    expect(uploadPathFromUrl("/uploads/../etc/passwd")).toBeNull();
    expect(uploadPathFromUrl("/uploads/tenants/demo/../../etc/passwd")).toBeNull();
    expect(uploadPathFromUrl("/uploads/%2e%2e/%2e%2e/etc/passwd")).toBeNull();
    expect(uploadPathFromUrl("/uploads/%E0%A4%A")).toBeNull();
  });

  it("rejects an empty path", () => {
    expect(uploadPathFromUrl("/uploads/")).toBeNull();
  });
});

describe("public vs session-gated uploads", () => {
  it("keeps pre-auth branding public in both layouts", () => {
    expect(isPublicUploadPath("branding/platform-logo.webp")).toBe(true);
    expect(isPublicUploadPath("tenants/demo/branding/logo.webp")).toBe(true);
  });

  it("requires a session for avatars and every other upload", () => {
    expect(isPublicUploadPath("avatars/user-1.webp")).toBe(false);
    expect(isPublicUploadPath("tenants/demo/avatars/u.webp")).toBe(false);
    expect(isPublicUploadPath("tenants/demo/exports/students.csv")).toBe(false);
    expect(isPublicUploadPath("tenants/demo/images/scan.webp")).toBe(false);
    expect(isPublicUploadPath("tenants/demo/attachments/report.pdf")).toBe(false);
    expect(isPublicUploadPath("images/anything.webp")).toBe(false);
    expect(isPublicUploadPath("branding")).toBe(false);
  });
});

describe("tenant segment", () => {
  it("returns the workspace for tenant-scoped paths", () => {
    expect(tenantSegmentOf("tenants/Demo/exports/a.csv")).toBe("demo");
    expect(tenantSegmentOf("tenants/demo")).toBe("demo");
  });

  it("returns null for platform-level paths", () => {
    expect(tenantSegmentOf("branding/x.webp")).toBeNull();
    expect(tenantSegmentOf("images/x.webp")).toBeNull();
    expect(tenantSegmentOf("tenants/")).toBeNull();
  });
});

describe("cache headers", () => {
  const headerSink = () => {
    const headers: Record<string, string> = {};
    return { headers, reply: { header: (n: string, v: string) => (headers[n] = v) } };
  };

  it("never lets a tenant upload be cached by shared proxies", () => {
    const { headers, reply } = headerSink();
    setStaticAssetHeaders(reply, "/srv/uploads/tenants/demo/exports/students.csv");
    expect(headers["Cache-Control"]).toBe("private, no-store");
  });

  it("sets the private cache contract on tenant and root-level attachments", () => {
    for (const path of [
      "/srv/uploads/tenants/demo/attachments/report.pdf",
      "/srv/uploads/attachments/legacy.pdf",
    ]) {
      const { headers, reply } = headerSink();
      setStaticAssetHeaders(reply, path);
      expect(headers["Cache-Control"]).toBe("private, no-store");
      expect(headers["Vary"]).toContain("Authorization");
      expect(headers["Content-Type"]).toBe("application/octet-stream");
      expect(headers["Content-Disposition"]).toBe("attachment");
    }
  });

  it("still allows public caching for branding", () => {
    const { headers, reply } = headerSink();
    setStaticAssetHeaders(reply, "/srv/uploads/branding/logo.webp");
    expect(headers["Cache-Control"]).toContain("public");
  });
});
