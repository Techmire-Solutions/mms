import { describe, expect, it, beforeEach } from "vitest";
import { resetSessionRefreshStateForTests, SESSION_EXPIRED_EVENT } from "@/lib/apiClient";

describe("apiClient", () => {
  beforeEach(() => {
    resetSessionRefreshStateForTests();
  });
  it("uses credentials include on fetch wrapper", async () => {
    const original = globalThis.fetch;
    let seenInit: RequestInit | undefined;
    globalThis.fetch = async (_input, init) => {
      seenInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const { apiFetch } = await import("@/lib/apiClient");
    await apiFetch("/api/health");
    expect(seenInit?.credentials).toBe("include");
    globalThis.fetch = original;
  });

  it("throws ApiError with stable type on failed JSON response", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "forbidden", message: "Denied" }), { status: 403 });
    const { apiJson, ApiError, isApiError } = await import("@/lib/apiClient");
    try {
      await apiJson("/api/students");
      expect.unreachable("should throw");
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
        expect(error.type).toBe("forbidden");
        expect(error.message).toBe("Denied");
      }
    }
    globalThis.fetch = original;
  });

  it("intercepts and sanitizes column preferences payload", async () => {
    const original = globalThis.fetch;
    let seenBody: string | undefined;
    globalThis.fetch = async (_input, init) => {
      seenBody = init?.body as string;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const { apiFetch } = await import("@/lib/apiClient");
    await apiFetch("/api/contacts/column-preferences", {
      method: "PUT",
      body: JSON.stringify({
        preferences: [
          { key: "name", enabled: "true", order: 1.5 },
          { key: "email", enabled: false, order: "2" },
          { key: "  ", enabled: true, order: 0 },
        ],
      }),
    });
    expect(typeof seenBody).toBe("string");
    const parsed = JSON.parse(seenBody!);
    expect(parsed.preferences).toEqual([
      { key: "name", enabled: true, order: 1 },
      { key: "email", enabled: false, order: 2 },
    ]);
    globalThis.fetch = original;
  });

  it("refreshes an expired tenant session and retries the original request once", async () => {
    const original = globalThis.fetch;
    const seenPaths: string[] = [];
    globalThis.fetch = async (input) => {
      const path = String(input);
      seenPaths.push(path);
      if (path === "/api/auth/refresh") {
        return new Response(JSON.stringify({ user: { id: "user-1" } }), { status: 200 });
      }
      if (seenPaths.filter((seenPath) => seenPath === "/api/students").length === 1) {
        return new Response(JSON.stringify({ type: "auth_required" }), { status: 401 });
      }
      return new Response(JSON.stringify({ students: [] }), { status: 200 });
    };

    const { apiJson } = await import("@/lib/apiClient");
    await expect(apiJson<{ students: unknown[] }>("/api/students")).resolves.toEqual({
      students: [],
    });
    expect(seenPaths).toEqual(["/api/students", "/api/auth/refresh", "/api/students"]);
    globalThis.fetch = original;
  });

  it("shares one refresh request across concurrent 401 responses", async () => {
    const original = globalThis.fetch;
    let refreshCount = 0;
    const requestCounts = new Map<string, number>();
    globalThis.fetch = async (input) => {
      const path = String(input);
      if (path === "/api/auth/refresh") {
        refreshCount += 1;
        await Promise.resolve();
        return new Response("{}", { status: 200 });
      }
      const count = (requestCounts.get(path) ?? 0) + 1;
      requestCounts.set(path, count);
      return count === 1
        ? new Response(JSON.stringify({ type: "auth_required" }), { status: 401 })
        : new Response("{}", { status: 200 });
    };

    const { apiFetch } = await import("@/lib/apiClient");
    const responses = await Promise.all([apiFetch("/api/students"), apiFetch("/api/contacts")]);
    expect(responses.every((response) => response.ok)).toBe(true);
    expect(refreshCount).toBe(1);
    globalThis.fetch = original;
  });

  it("does not refresh public authentication failures", async () => {
    const original = globalThis.fetch;
    const seenPaths: string[] = [];
    globalThis.fetch = async (input) => {
      seenPaths.push(String(input));
      return new Response(JSON.stringify({ type: "invalid_credentials" }), { status: 401 });
    };

    const { apiFetch } = await import("@/lib/apiClient");
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "invalid" }),
    });
    expect(response.status).toBe(401);
    expect(seenPaths).toEqual(["/api/auth/login"]);
    globalThis.fetch = original;
  });

  it("injects X-Request-Id header in requests", async () => {
    const original = globalThis.fetch;
    let seenHeaders: Headers | undefined;
    globalThis.fetch = async (_input, init) => {
      seenHeaders = init?.headers as Headers;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const { apiFetch } = await import("@/lib/apiClient");
    await apiFetch("/api/health");
    const reqId = seenHeaders?.get("X-Request-Id");
    expect(typeof reqId).toBe("string");
    expect(reqId?.length).toBeGreaterThan(0);
    globalThis.fetch = original;
  });

  it("safely handles non-JSON responses in apiJson", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("<html>Error</html>", { status: 502, statusText: "Bad Gateway" });

    const { apiJson, ApiError } = await import("@/lib/apiClient");
    await expect(apiJson("/api/health")).rejects.toThrow(ApiError);
    try {
      await apiJson("/api/health");
    } catch (error) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(502);
        expect(error.message).toContain("Error");
      }
    }
    globalThis.fetch = original;
  });

  it("supports request timeouts and abort signal propagation", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      return new Promise((resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new DOMException("Request aborted", "AbortError"));
          return;
        }
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Request aborted", "AbortError"));
        });
      });
    };

    const { apiFetch } = await import("@/lib/apiClient");
    await expect(apiFetch("/api/health", { timeout: 10 } as unknown as never)).rejects.toThrow();
    globalThis.fetch = original;
  });

  it("parses and attaches x-request-id on ApiError on failure", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      const headers = new Headers({ "x-request-id": "test-trace-id-123" });
      return new Response(JSON.stringify({ type: "forbidden", message: "Access denied" }), {
        status: 403,
        headers,
      });
    };

    const { apiJson, ApiError } = await import("@/lib/apiClient");
    try {
      await apiJson("/api/health");
      expect.unreachable("should throw");
    } catch (error) {
      if (error instanceof ApiError) {
        expect(error.status).toBe(403);
        expect(error.requestId).toBe("test-trace-id-123");
      }
    }
    globalThis.fetch = original;
  });

  it("parses Retry-After into ApiError.retryAfterSeconds", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "rate_limit_exceeded", message: "Too many requests" }), {
        status: 429,
        headers: new Headers({ "Retry-After": "12" }),
      });

    const { apiJson, ApiError } = await import("@/lib/apiClient");
    try {
      await apiJson("/api/messaging/logs");
      expect.unreachable("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.status).toBe(429);
        expect(error.type).toBe("rate_limit_exceeded");
        expect(error.retryAfterSeconds).toBe(12);
      }
    }
    globalThis.fetch = original;
  });

  it("leaves retryAfterSeconds undefined when Retry-After is missing", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ type: "rate_limit_exceeded", message: "Too many requests" }), {
        status: 429,
      });

    const { apiJson, ApiError } = await import("@/lib/apiClient");
    try {
      await apiJson("/api/messaging/logs");
      expect.unreachable("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.retryAfterSeconds).toBeUndefined();
      }
    }
    globalThis.fetch = original;
  });

  it("escalates a second 401 after a successful refresh to session expiry", async () => {
    const original = globalThis.fetch;
    const seenPaths: string[] = [];
    globalThis.fetch = async (input) => {
      const path = String(input);
      seenPaths.push(path);
      if (path === "/api/auth/refresh") {
        return new Response("{}", { status: 200 });
      }
      return new Response(JSON.stringify({ type: "auth_required", message: "Unauthorized" }), {
        status: 401,
      });
    };
    const expiredReasons: string[] = [];
    const onExpired = (event: Event): void => {
      expiredReasons.push((event as CustomEvent<{ reason?: string }>).detail?.reason ?? "unknown");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    try {
      const { apiFetch } = await import("@/lib/apiClient");

      // Act
      const response = await apiFetch("/api/students");

      // Assert
      expect(response.status).toBe(401);
      expect(seenPaths).toEqual(["/api/students", "/api/auth/refresh", "/api/students"]);
      expect(expiredReasons).toEqual(["refresh_retry_failed"]);
    } finally {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      globalThis.fetch = original;
    }
  });
});
