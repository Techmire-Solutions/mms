import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  type MinimalWebSocket,
  registerConnection,
  broadcastLocalTenantUpdate,
  broadcastTenantUpdate,
  broadcastLocalJobEvent,
  closeAllConnections,
  getActiveConnectionsCount,
  MAX_WS_BUFFERED_AMOUNT,
  WS_TELEMETRY_BUFFERED_LIMIT,
} from "../lib/livePush.js";

interface MockSocket extends MinimalWebSocket {
  terminateMock: ReturnType<typeof vi.fn>;
  pingMock: ReturnType<typeof vi.fn>;
  sendMock: ReturnType<typeof vi.fn>;
  closeMock: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
}

function createMockSocket(bufferedAmount = 0): MockSocket {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  const terminateMock = vi.fn();
  const pingMock = vi.fn();
  const sendMock = vi.fn();
  const closeMock = vi.fn();

  const socket: MockSocket = {
    bufferedAmount,
    terminateMock,
    pingMock,
    sendMock,
    closeMock,
    close(code?: number, reason?: string) {
      closeMock(code, reason);
    },
    terminate() {
      terminateMock();
    },
    ping() {
      pingMock();
    },
    send(data: string) {
      sendMock(data);
    },
    on(event, listener) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(listener);
    },
    off(event, listener) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((l) => l !== listener);
    },
    emit(event, ...args) {
      const handlers = listeners[event] ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
    },
  };
  return socket;
}

describe("WebSocket LivePush Backpressure & Heartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    closeAllConnections();
  });

  afterEach(() => {
    closeAllConnections();
    vi.useRealTimers();
  });

  it("drops telemetry when socket buffer exceeds 64KB soft limit", () => {
    const socket = createMockSocket(WS_TELEMETRY_BUFFERED_LIMIT + 1024);
    const unregister = registerConnection("alpha", socket, "user-1");

    broadcastLocalTenantUpdate("alpha", "collection", "students");

    expect(socket.sendMock).not.toHaveBeenCalled();
    expect(socket.terminateMock).not.toHaveBeenCalled();
    unregister?.();
  });

  it("terminates connection when socket buffer exceeds 512KB hard ceiling", () => {
    const socket = createMockSocket(MAX_WS_BUFFERED_AMOUNT + 1024);
    const unregister = registerConnection("alpha", socket, "user-1");

    broadcastLocalTenantUpdate("alpha", "collection", "students");

    expect(socket.sendMock).not.toHaveBeenCalled();
    expect(socket.terminateMock).toHaveBeenCalled();
    unregister?.();
  });

  it("sends message when buffer is well below threshold", () => {
    const socket = createMockSocket(1024);
    const unregister = registerConnection("alpha", socket, "user-1");

    broadcastLocalTenantUpdate("alpha", "collection", "students");

    expect(socket.sendMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(socket.sendMock.mock.calls[0][0] as string);
    expect(payload).toEqual({
      event: "database-update",
      type: "collection",
      key: "students",
    });
    unregister?.();
  });

  it("proactively terminates socket when pong deadline expires (10s)", () => {
    const socket = createMockSocket(0);
    registerConnection("alpha", socket, "user-1");

    expect(getActiveConnectionsCount()).toBe(1);

    // Advance to ping interval
    vi.advanceTimersToNextTimer();
    expect(socket.pingMock).toHaveBeenCalled();

    // Advance to pong deadline timeout
    vi.advanceTimersToNextTimer();
    expect(socket.terminateMock).toHaveBeenCalled();
    expect(getActiveConnectionsCount()).toBe(0);
  });

  it("keeps socket alive when pong is received before deadline", () => {
    const socket = createMockSocket(0);
    registerConnection("alpha", socket, "user-1");

    // Advance to ping interval
    vi.advanceTimersToNextTimer();
    expect(socket.pingMock).toHaveBeenCalled();

    // Socket responds with pong
    socket.emit("pong");

    // Advance time - should not terminate
    vi.advanceTimersByTime(15_000);
    expect(socket.terminateMock).not.toHaveBeenCalled();
    expect(getActiveConnectionsCount()).toBe(1);
  });
});

describe("WebSocket Tenant Isolation & Egress Partitioning", () => {
  beforeEach(() => {
    closeAllConnections();
  });

  afterEach(() => {
    closeAllConnections();
  });

  it("strictly isolates broadcasts so tenant B never receives tenant A updates", () => {
    const socketAlpha = createMockSocket(0);
    const socketBeta = createMockSocket(0);

    const unregAlpha = registerConnection("alpha", socketAlpha, "user-alpha");
    const unregBeta = registerConnection("beta", socketBeta, "user-beta");

    broadcastLocalTenantUpdate("alpha", "collection", "finance_invoices");

    expect(socketAlpha.sendMock).toHaveBeenCalledTimes(1);
    expect(socketBeta.sendMock).not.toHaveBeenCalled();

    broadcastLocalTenantUpdate("beta", "collection", "students");

    expect(socketAlpha.sendMock).toHaveBeenCalledTimes(1);
    expect(socketBeta.sendMock).toHaveBeenCalledTimes(1);

    unregAlpha?.();
    unregBeta?.();
  });

  it("sanitizes job event payloads on egress", () => {
    const socketAlpha = createMockSocket(0);
    const unreg = registerConnection("alpha", socketAlpha, "user-1");

    broadcastLocalJobEvent({
      event: "job-progress",
      tenantId: "alpha",
      jobId: "job-123",
      moduleId: "finance",
      progress: { current: 50, total: 100, percent: 50 },
    });

    expect(socketAlpha.sendMock).toHaveBeenCalledTimes(1);
    const msg = JSON.parse(socketAlpha.sendMock.mock.calls[0][0] as string);
    expect(msg.tenantId).toBe("alpha");
    expect(msg.jobId).toBe("job-123");
    expect(msg.progress.percent).toBe(50);

    unreg?.();
  });

  it("broadcasts object updates (settings, branding, fields) to tenant sockets", () => {
    const socketAlpha = createMockSocket(0);
    const unreg = registerConnection("alpha", socketAlpha, "user-1");

    broadcastTenantUpdate("alpha", "object", "settings");
    broadcastTenantUpdate("alpha", "object", "branding");
    broadcastTenantUpdate("alpha", "object", "fields");

    expect(socketAlpha.sendMock).toHaveBeenCalledTimes(3);
    const firstMsg = JSON.parse(socketAlpha.sendMock.mock.calls[0][0] as string);
    expect(firstMsg).toEqual({
      event: "database-update",
      type: "object",
      key: "settings",
    });

    unreg?.();
  });
});
