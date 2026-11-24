import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_EXPIRED_EVENT,
  apiFetch,
  apiJson,
  configureApiClient,
  resetApiClientConfigForTests,
  resetSessionRefreshStateForTests,
} from "./client.js";
import { ApiError } from "./errors.js";
import { API_REFRESH_PATH } from "./helpers.js";

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

const stubFetch = (
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const clearCsrfCookie = (): void => {
  document.cookie = "csrf_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
};

beforeEach(() => {
  resetApiClientConfigForTests();
  resetSessionRefreshStateForTests();
  clearCsrfCookie();
});

afterEach(() => {
  resetApiClientConfigForTests();
  resetSessionRefreshStateForTests();
  clearCsrfCookie();
  vi.unstubAllGlobals();
});

describe("api client context headers", () => {
  it("sends the injected tenant id and honours the custom request-id generator", async () => {
    const fetchMock = stubFetch(() => jsonResponse({}));
    configureApiClient({ getTenantId: () => "acme", getRequestId: () => "req-123" });

    await apiFetch("/api/students");

    const init = fetchMock.mock.calls[0]?.[1];
    if (!init) throw new Error("fetch was not called");
    const headers = init.headers as Headers;
    expect(headers.get("x-tenant-id")).toBe("acme");
    expect(headers.get("x-request-id")).toBe("req-123");
    expect(init.credentials).toBe("include");
  });

  it("omits X-Tenant-Id on the apex (no active tenant)", async () => {
    const fetchMock = stubFetch(() => jsonResponse({}));
    configureApiClient({ getTenantId: () => null });

    await apiFetch("/api/public/health");

    const init = fetchMock.mock.calls[0]?.[1];
    if (!init) throw new Error("fetch was not called");
    expect((init.headers as Headers).has("x-tenant-id")).toBe(false);
  });

  it("preserves a caller-provided correlation id and fills the gap otherwise", async () => {
    const fetchMock = stubFetch(() => jsonResponse({}));
    configureApiClient({ getRequestId: () => "generated-id" });

    await apiFetch("/api/students", { headers: { "X-Request-Id": "caller-id" } });
    await apiFetch("/api/students");

    const callerHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    const generatedHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(callerHeaders.get("x-request-id")).toBe("caller-id");
    expect(generatedHeaders.get("x-request-id")).toBe("generated-id");
  });

  it("sends the double-submit CSRF token on mutations only", async () => {
    document.cookie = "csrf_token=token-abc; path=/";
    const fetchMock = stubFetch(() => jsonResponse({}));

    await apiFetch("/api/students", { method: "POST" });
    await apiFetch("/api/students");

    const mutationHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    const readHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(mutationHeaders.get("x-csrf-token")).toBe("token-abc");
    expect(readHeaders.has("x-csrf-token")).toBe(false);
  });
});

describe("apiJson error normalization", () => {
  it("maps the JSON error envelope onto ApiError including details and retry-after", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            type: "validation_failed",
            message: "Fix the highlighted fields",
            errors: { name: ["Required"] },
            code: "E_VALIDATION",
            details: { students: [7] },
          }),
          {
            status: 422,
            headers: {
              "content-type": "application/json",
              "x-request-id": "rid-1",
              "retry-after": "7",
            },
          },
        ),
    );

    const error = await apiJson("/api/students").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      type: "validation_failed",
      message: "Fix the highlighted fields",
      errors: { name: ["Required"] },
      code: "E_VALIDATION",
      details: { students: [7] },
      requestId: "rid-1",
      retryAfterSeconds: 7,
    });
  });

  it("falls back to the raw text when the error body is not JSON", async () => {
    stubFetch(() => new Response("upstream exploded", { status: 500 }));

    await expect(apiJson("/api/students")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      type: "request_failed",
      message: "upstream exploded",
    });
  });
});

describe("session refresh interceptor", () => {
  it("shares one refresh between concurrent 401s and retries both requests", async () => {
    let studentsCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes(API_REFRESH_PATH)) {
        return new Response("{}", { status: 200 });
      }
      studentsCalls += 1;
      return studentsCalls <= 2 ? new Response("{}", { status: 401 }) : jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const responses = await Promise.all([apiFetch("/api/students"), apiFetch("/api/students")]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const refreshCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes(API_REFRESH_PATH),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("dispatches the expiry event for idle/absolute session 401s without refreshing", async () => {
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    const fetchMock = stubFetch(
      () => new Response(JSON.stringify({ type: "session_idle_expired" }), { status: 401 }),
    );

    const response = await apiFetch("/api/students");

    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect((onExpired.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      reason: "session_idle_expired",
    });
  });

  it("emits exactly one expiry event when the refresh itself fails", async () => {
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    const fetchMock = stubFetch(() => new Response("{}", { status: 401 }));

    const response = await apiFetch("/api/students");

    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    expect(response.status).toBe(401);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect((onExpired.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      reason: "refresh_failed",
    });
    const refreshCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes(API_REFRESH_PATH),
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
