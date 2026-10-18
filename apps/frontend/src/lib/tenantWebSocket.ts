import { resolveApiUrl } from "@/lib/apiClientHelpers";
import { notifySessionExpired } from "@/lib/apiClient";
import type { BackgroundJobEventMessage } from "@mms/shared";

export type TenantDatabaseUpdateMessage = {
  event: "database-update";
  type: "collection" | "object";
  key: string;
};

export type TenantWebSocketMessage = TenantDatabaseUpdateMessage | BackgroundJobEventMessage;

export function resolveTenantWebSocketUrl(): string {
  const httpUrl = resolveApiUrl("/api/ws");
  if (/^https?:\/\//i.test(httpUrl)) {
    return httpUrl.replace(/^http/i, "ws");
  }
  if (typeof window === "undefined") return "ws://127.0.0.1/api/ws";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws`;
}

export function parseTenantDatabaseUpdate(
  raw: string | unknown,
): TenantDatabaseUpdateMessage | null {
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (record.event !== "database-update") return null;
    if (record.type !== "collection" && record.type !== "object") return null;
    if (typeof record.key !== "string" || !record.key.trim()) return null;
    return {
      event: "database-update",
      type: record.type,
      key: record.key,
    };
  } catch {
    return null;
  }
}

function parseProgress(value: unknown): BackgroundJobEventMessage["progress"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const p = value as Record<string, unknown>;
  return typeof p.current === "number" &&
    typeof p.total === "number" &&
    typeof p.percent === "number"
    ? { current: p.current, total: p.total, percent: p.percent }
    : undefined;
}

export function parseTenantJobEvent(raw: string | unknown): BackgroundJobEventMessage | null {
  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const r = parsed as Record<string, unknown>;
    if (r.event !== "job-progress" && r.event !== "job-completed" && r.event !== "job-failed")
      return null;
    if (typeof r.jobId !== "string" || typeof r.tenantId !== "string") return null;
    const progress = parseProgress(r.progress);
    return {
      event: r.event,
      tenantId: r.tenantId,
      jobId: r.jobId,
      ...(typeof r.userId === "string" ? { userId: r.userId } : {}),
      ...(typeof r.moduleId === "string" ? { moduleId: r.moduleId } : {}),
      ...(typeof r.kind === "string" ? { kind: r.kind } : {}),
      ...(typeof r.label === "string" ? { label: r.label } : {}),
      ...(progress ? { progress } : {}),
      ...(typeof r.hasDownload === "boolean" ? { hasDownload: r.hasDownload } : {}),
      ...(typeof r.error === "string" ? { error: r.error } : {}),
      ...(typeof r.completedAt === "string" ? { completedAt: r.completedAt } : {}),
    };
  } catch {
    return null;
  }
}

type TenantWebSocketHandlers = {
  onDatabaseUpdate: (message: TenantDatabaseUpdateMessage) => void;
  onJobEvent?: (message: BackgroundJobEventMessage) => void;
  onError?: (error: unknown) => void;
};

/**
 * Cookie-auth tenant WS client for `/api/ws`.
 * Reconnects with exponential backoff; browser handles ping/pong automatically.
 */
export function connectTenantDatabaseSocket(handlers: TenantWebSocketHandlers): () => void {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const clearReconnect = () => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closedByCaller) return;
    clearReconnect();
    const delayMs = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
    attempt += 1;
    reconnectTimer = setTimeout(open, delayMs);
  };

  const open = () => {
    if (closedByCaller) return;
    clearReconnect();
    try {
      socket = new WebSocket(resolveTenantWebSocketUrl());
    } catch (error) {
      handlers.onError?.(error);
      scheduleReconnect();
      return;
    }

    const onOpen = () => {
      attempt = 0;
    };

    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data) as unknown;
        const dbUpdate = parseTenantDatabaseUpdate(parsed);
        if (dbUpdate) {
          handlers.onDatabaseUpdate(dbUpdate);
          return;
        }
        const jobEvent = parseTenantJobEvent(parsed);
        if (jobEvent) {
          handlers.onJobEvent?.(jobEvent);
        }
      } catch {
        /* ignore invalid JSON */
      }
    };

    const onError = (event: Event) => {
      handlers.onError?.(event);
    };

    const cleanupSocket = (s: WebSocket) => {
      s.removeEventListener("open", onOpen);
      s.removeEventListener("message", onMessage);
      s.removeEventListener("error", onError);
      s.removeEventListener("close", onClose);
      s.onopen = null;
      s.onmessage = null;
      s.onerror = null;
      s.onclose = null;
    };

    const onClose = (event: CloseEvent) => {
      if (socket) {
        cleanupSocket(socket);
        socket = null;
      }
      if (!closedByCaller && event.code === 4001) {
        notifySessionExpired("websocket_unauthorized");
      }
      // Do not auto-reconnect if closed due to auth, missing token, or subdomain mismatch (4000-4009)
      if (!closedByCaller && (event.code < 4000 || event.code > 4009)) {
        scheduleReconnect();
      }
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onError);
    socket.addEventListener("close", onClose);
  };

  open();

  return () => {
    closedByCaller = true;
    clearReconnect();
    if (socket) {
      const s = socket;
      socket = null;
      s.onopen = null;
      s.onmessage = null;
      s.onerror = null;
      s.onclose = null;
      if (s.readyState === WebSocket.CONNECTING) {
        const handleConnectingOpen = () => {
          s.removeEventListener("open", handleConnectingOpen);
          s.close(1000, "Client unmounted");
        };
        s.addEventListener("open", handleConnectingOpen, { once: true });
      } else if (s.readyState === WebSocket.OPEN) {
        s.close(1000, "Client unmounted");
      }
    }
  };
}
