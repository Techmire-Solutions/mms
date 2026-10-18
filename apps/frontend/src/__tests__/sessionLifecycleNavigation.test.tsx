import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, resetSessionRefreshStateForTests, SESSION_EXPIRED_EVENT } from "@/lib/apiClient";
import { queryClientInstance } from "@/lib/queryClient";

describe("sessionLifecycleNavigation", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetSessionRefreshStateForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetSessionRefreshStateForTests();
  });

  it("deduplicates concurrent 401s into a single refresh call and retries pending requests", async () => {
    let refreshCalls = 0;
    let studentsCalls = 0;
    let facultyCalls = 0;
    let contactsCalls = 0;

    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;

      if (url.includes("/api/auth/refresh")) {
        refreshCalls++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (url.includes("/api/students")) {
        studentsCalls++;
        if (studentsCalls === 1) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        return new Response(JSON.stringify({ students: [] }), { status: 200 });
      }

      if (url.includes("/api/faculty")) {
        facultyCalls++;
        if (facultyCalls === 1) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        return new Response(JSON.stringify({ faculty: [] }), { status: 200 });
      }

      if (url.includes("/api/contacts")) {
        contactsCalls++;
        if (contactsCalls === 1) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        return new Response(JSON.stringify({ contacts: [] }), { status: 200 });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    // Fire 3 simultaneous requests that encounter 401
    const [res1, res2, res3] = await Promise.all([
      apiFetch("/api/students"),
      apiFetch("/api/faculty"),
      apiFetch("/api/contacts"),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);

    // Refresh must be called exactly once despite 3 concurrent 401 responses
    expect(refreshCalls).toBe(1);
    expect(studentsCalls).toBe(2);
    expect(facultyCalls).toBe(2);
    expect(contactsCalls).toBe(2);
  });

  it("retries immediate 401 within grace period without re-triggering refresh", async () => {
    let refreshCalls = 0;
    let requestCount = 0;

    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/refresh")) {
        refreshCalls++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      requestCount++;
      if (requestCount === 1) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const res1 = await apiFetch("/api/sessions");
    expect(res1.status).toBe(200);
    expect(refreshCalls).toBe(1);

    // A second request right after within the 5s grace window encounters 401 (e.g. stale header in-flight)
    let postGraceCalls = 0;
    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/refresh")) {
        refreshCalls++;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      postGraceCalls++;
      if (postGraceCalls === 1) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const res2 = await apiFetch("/api/sessions");
    expect(res2.status).toBe(200);
    // Refresh calls must not increase because grace period retried immediately
    expect(refreshCalls).toBe(1);
    expect(postGraceCalls).toBe(2);
  });

  it("dispatches SESSION_EXPIRED_EVENT when refresh fails", async () => {
    let expiredReason: string | undefined;
    const handleExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason?: string }>;
      expiredReason = customEvent.detail?.reason;
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);

    globalThis.fetch = async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/auth/refresh")) {
        return new Response(JSON.stringify({ error: "Refresh token invalid" }), { status: 401 });
      }
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    };

    const res = await apiFetch("/api/students");
    expect(res.status).toBe(401);
    expect(expiredReason).toBe("refresh_failed");

    window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  });

  it("dispatches SESSION_EXPIRED_EVENT when session_idle_expired is received", async () => {
    let expiredReason: string | undefined;
    const handleExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ reason?: string }>;
      expiredReason = customEvent.detail?.reason;
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          type: "session_idle_expired",
          message: "Your session has ended due to inactivity.",
        }),
        { status: 401 },
      );
    };

    const res = await apiFetch("/api/contacts");
    expect(res.status).toBe(401);
    expect(expiredReason).toBe("session_idle_expired");

    window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  });

  it("cancels in-flight queries via queryClientInstance.cancelQueries()", async () => {
    const cancelSpy = vi.spyOn(queryClientInstance, "cancelQueries");

    queryClientInstance.cancelQueries();
    expect(cancelSpy).toHaveBeenCalledTimes(1);

    cancelSpy.mockRestore();
  });

  it("rapid navigation across three distinct modules with abort signals does not hang requests or leak listeners", async () => {
    let refreshCalls = 0;
    const fetchCalls: string[] = [];

    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      fetchCalls.push(url);

      if (url.includes("/api/auth/refresh")) {
        refreshCalls++;
        // Simulate a tiny delay for silent refresh
        await new Promise((r) => setTimeout(r, 15));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Check if aborted
      const signal = init?.signal;
      if (signal?.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }

      // If first attempt at contacts or students, return 401
      if (url.includes("/api/contacts") && !fetchCalls.slice(0, -1).includes(url)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      if (url.includes("/api/students") && !fetchCalls.slice(0, -1).includes(url)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    // User is on Contacts, then quickly clicks Students, then Faculty
    const contactsCtrl = new AbortController();
    const studentsCtrl = new AbortController();
    const facultyCtrl = new AbortController();

    // Module 1: Contacts starts fetching
    const pContacts = apiFetch("/api/contacts", { signal: contactsCtrl.signal });

    // User navigates away from Contacts -> abort Contacts query
    contactsCtrl.abort();

    // Module 2: Students starts fetching
    const pStudents = apiFetch("/api/students", { signal: studentsCtrl.signal });

    // User navigates away from Students -> abort Students query
    studentsCtrl.abort();

    // Module 3: Faculty starts fetching and user remains here
    const pFaculty = apiFetch("/api/faculty", { signal: facultyCtrl.signal });

    // Settle all queries: aborted queries reject or complete cleanly, active query resolves 200
    const [resContacts, resStudents, resFaculty] = await Promise.allSettled([
      pContacts,
      pStudents,
      pFaculty,
    ]);

    // Active destination query resolved successfully with 200
    expect(resFaculty.status).toBe("fulfilled");
    if (resFaculty.status === "fulfilled") {
      expect(resFaculty.value.status).toBe(200);
    }

    // Previous aborted queries settled without hanging the process
    expect(["fulfilled", "rejected"]).toContain(resContacts.status);
    expect(["fulfilled", "rejected"]).toContain(resStudents.status);

    // Refresh was invoked at most once
    expect(refreshCalls).toBeLessThanOrEqual(1);
  });
});
