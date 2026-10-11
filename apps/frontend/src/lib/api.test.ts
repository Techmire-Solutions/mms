import { describe, expect, it, vi } from "vitest";
import { tsrClient, apiContract } from "./api";

describe("tsrClient & contract integration (Phase 7)", () => {
  it("transports contract GET queries through apiFetch", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    let seenHeaders: HeadersInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      requestedUrl = url;
      seenHeaders = init?.headers;
      return new Response(
        JSON.stringify({
          students: [
            {
              id: "student-1",
              fullName: "Ahmad Khan",
              grNumber: "GR-100",
              status: "active",
              admissionDate: "2026-01-01",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        }),
        {
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
        },
      );
    });

    try {
      const response = await apiContract.students.list({
        query: { page: 1, limit: 20, search: "Ahmad" },
      });

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe("object");
      expect(requestedUrl).toContain("/api/students");
      expect(requestedUrl).toContain("search=Ahmad");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("transports contract POST mutations with JSON payloads", async () => {
    const originalFetch = globalThis.fetch;
    let requestBody = "";
    let requestMethod = "";

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      requestMethod = init?.method ?? "";
      requestBody = init?.body as string;
      return new Response(
        JSON.stringify({
          id: "student-99",
          fullName: "Zainab Ali",
          grNumber: "GR-999",
          status: "active",
          admissionDate: "2026-01-10",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        {
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
        },
      );
    });

    try {
      const response = await apiContract.students.create({
        body: {
          name: "Zainab Ali",
          grNumber: "GR-999",
          registeredDate: "2026-01-10",
        },
      });

      expect(response.status).toBe(201);
      expect(requestMethod).toBe("POST");
      const parsedBody = JSON.parse(requestBody);
      expect(parsedBody.name).toBe("Zainab Ali");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles text and error responses gracefully", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return new Response("plain error text", {
        status: 500,
        headers: new Headers({ "content-type": "text/plain" }),
      });
    });

    try {
      const response = await apiContract.students.list({
        query: { page: 1, limit: 10 },
      });
      expect(response.status).toBe(500);
      expect(response.body).toBe("plain error text");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("exposes tsrClient with rootContract endpoint router methods", () => {
    expect(typeof tsrClient.students.list).toBe("object");
    expect(typeof tsrClient.students.create).toBe("object");
    expect(typeof tsrClient.contacts.list).toBe("object");
    expect(typeof tsrClient.finance.listInvoices).toBe("object");
    expect(typeof tsrClient.attendance.list).toBe("object");
    expect(typeof tsrClient.faculty.list).toBe("object");
    expect(typeof tsrClient.dashboard.getSummary).toBe("object");
    expect(typeof tsrClient.sessions.list).toBe("object");
    expect(typeof tsrClient.enrollments.list).toBe("object");
    expect(typeof tsrClient.accounting.listAccounts).toBe("object");
    expect(typeof tsrClient.obligations.listCollections).toBe("object");
    expect(typeof tsrClient.hasanat.listDistributions).toBe("object");
    expect(typeof tsrClient.messaging.listLogs).toBe("object");
    expect(typeof tsrClient.examinations.listExams).toBe("object");
    expect(typeof tsrClient.questionBank.listQuestions).toBe("object");
  });

  it("transports contract GET queries for faculty and contacts", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrl = url;
      return new Response(
        JSON.stringify({
          contacts: [],
          total: 0,
          page: 1,
          limit: 20,
        }),
        {
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
        },
      );
    });

    try {
      const response = await apiContract.contacts.list({
        query: { page: 1, limit: 20, search: "test" },
      });

      expect(response.status).toBe(200);
      expect(requestedUrl).toContain("/api/contacts");
      expect(requestedUrl).toContain("search=test");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
