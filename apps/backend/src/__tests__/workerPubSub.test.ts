import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerConnection,
  registerSseConnection,
  broadcastLocalTenantUpdate,
  broadcastLocalJobEvent,
  configureRedisPubSub,
  type MinimalWebSocket,
  type MinimalSseResponse,
} from "../lib/livePush.js";

describe("Worker Redis Pub/Sub & WebSocket Hub Integration (Phase 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("delivers job-progress and job-completed events to connected tenant client sockets", () => {
    const sentMessages: string[] = [];
    const mockSocket: MinimalWebSocket = {
      close: vi.fn(),
      terminate: vi.fn(),
      ping: vi.fn(),
      send: vi.fn((data: string) => {
        sentMessages.push(data);
      }),
      on: vi.fn(),
    };

    const cleanup = registerConnection("alpha", mockSocket, "user-123");

    // Broadcast a job-progress event for tenant alpha and user user-123
    broadcastLocalJobEvent({
      event: "job-progress",
      tenantId: "alpha",
      userId: "user-123",
      jobId: "job-402",
      moduleId: "contacts",
      kind: "export-csv",
      progress: { current: 50, total: 100, percent: 50 },
    });

    expect(sentMessages.length).toBe(1);
    const progressPayload = JSON.parse(sentMessages[0]);
    expect(progressPayload.event).toBe("job-progress");
    expect(progressPayload.jobId).toBe("job-402");
    expect(progressPayload.progress.percent).toBe(50);

    // Broadcast a job-completed event
    broadcastLocalJobEvent({
      event: "job-completed",
      tenantId: "alpha",
      userId: "user-123",
      jobId: "job-402",
      moduleId: "contacts",
      kind: "export-csv",
      label: "Exported 100 contacts",
      hasDownload: true,
    });

    expect(sentMessages.length).toBe(2);
    const completedPayload = JSON.parse(sentMessages[1]);
    expect(completedPayload.event).toBe("job-completed");
    expect(completedPayload.hasDownload).toBe(true);

    cleanup?.();
  });

  it("filters job events by user ID and tenant isolation", () => {
    const user1Messages: string[] = [];
    const user2Messages: string[] = [];

    const socket1: MinimalWebSocket = {
      close: vi.fn(),
      terminate: vi.fn(),
      ping: vi.fn(),
      send: vi.fn((data) => user1Messages.push(data)),
      on: vi.fn(),
    };
    const socket2: MinimalWebSocket = {
      close: vi.fn(),
      terminate: vi.fn(),
      ping: vi.fn(),
      send: vi.fn((data) => user2Messages.push(data)),
      on: vi.fn(),
    };

    const cleanup1 = registerConnection("alpha", socket1, "user-1");
    const cleanup2 = registerConnection("beta", socket2, "user-2");

    // Send event targeted to user-1 on tenant alpha
    broadcastLocalJobEvent({
      event: "job-completed",
      tenantId: "alpha",
      userId: "user-1",
      jobId: "job-501",
    });

    expect(user1Messages.length).toBe(1);
    expect(user2Messages.length).toBe(0);

    cleanup1?.();
    cleanup2?.();
  });

  it("configures Redis Pub/Sub adapter and processes incoming subscription messages", async () => {
    const mockPublisher = {
      publish: vi.fn().mockResolvedValue(1),
    };
    let messageListener: ((channel: string, message: string) => void) | undefined;
    const mockSubscriber = {
      subscribe: vi.fn().mockResolvedValue("OK"),
      on: vi.fn((event: string, listener: (channel: string, message: string) => void) => {
        if (event === "message") {
          messageListener = listener;
        }
      }),
    };

    configureRedisPubSub(mockPublisher, mockSubscriber);

    expect(mockSubscriber.subscribe).toHaveBeenCalledWith("mms:ws-invalidation", "mms:job-event");
    expect(typeof messageListener).toBe("function");

    const socketMessages: string[] = [];
    const socket: MinimalWebSocket = {
      close: vi.fn(),
      terminate: vi.fn(),
      ping: vi.fn(),
      send: vi.fn((data) => socketMessages.push(data)),
      on: vi.fn(),
    };
    const cleanup = registerConnection("gamma", socket, "user-9");

    // Simulate Redis Pub/Sub message incoming on mms:job-event
    messageListener!(
      "mms:job-event",
      JSON.stringify({
        event: "job-progress",
        tenantId: "gamma",
        userId: "user-9",
        jobId: "job-888",
        progress: { current: 10, total: 20, percent: 50 },
      }),
    );

    expect(socketMessages.length).toBe(1);
    expect(JSON.parse(socketMessages[0]).jobId).toBe("job-888");

    cleanup?.();
  });

  it("delivers job and database updates to active SSE connections with chunked frames", () => {
    const sseChunks: string[] = [];
    const headersSent: Record<string, string> = {};
    const mockResponse: MinimalSseResponse = {
      writeHead: vi.fn((_status: number, headers: Record<string, string>) => {
        Object.assign(headersSent, headers);
      }),
      write: vi.fn((chunk: string | Buffer) => {
        sseChunks.push(chunk.toString());
        return true;
      }),
      end: vi.fn(),
      on: vi.fn(),
    };

    const cleanup = registerSseConnection("alpha", mockResponse, "user-sse");

    expect(headersSent["Content-Type"]).toBe("text/event-stream");
    expect(headersSent["Transfer-Encoding"]).toBe("chunked");
    expect(headersSent["X-Accel-Buffering"]).toBe("no");
    expect(sseChunks).toContain(": connected\n\n");

    broadcastLocalTenantUpdate("alpha", "collection", "students");
    expect(
      sseChunks.some((c) => c.includes("event: database-update") && c.includes("students")),
    ).toBe(true);

    broadcastLocalJobEvent({
      event: "job-progress",
      tenantId: "alpha",
      userId: "user-sse",
      jobId: "job-999",
    });
    expect(sseChunks.some((c) => c.includes("event: job-event") && c.includes("job-999"))).toBe(
      true,
    );

    cleanup?.();
  });
});
