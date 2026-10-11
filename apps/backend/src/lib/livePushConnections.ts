import { logger } from "./logger.js";

export interface MinimalWebSocket {
  close(code?: number, reason?: string): void;
  terminate(): void;
  ping(): void;
  send(data: string): void;
  bufferedAmount?: number;
  on(event: "pong", listener: () => void): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  off?(event: string, listener: (...args: [Error]) => void): void;
  removeListener?(event: string, listener: (...args: [Error]) => void): void;
}

export interface MinimalSseResponse {
  writeHead?(statusCode: number, headers: Record<string, string>): void;
  setHeader?(name: string, value: string): void;
  flushHeaders?(): void;
  write(chunk: string | Buffer): boolean;
  end(): void;
  on(event: "close" | "error", listener: (err?: Error) => void): void;
  off?(event: string, listener: (err?: Error) => void): void;
  removeListener?(event: string, listener: (err?: Error) => void): void;
}

export const SSE_STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "Transfer-Encoding": "chunked",
} as const;

export const WS_TELEMETRY_BUFFERED_LIMIT = 64 * 1024; // 64 KB soft threshold for non-critical telemetry
export const MAX_WS_BUFFERED_AMOUNT = 512 * 1024; // 512 KB hard ceiling for socket termination
export const WS_HEARTBEAT_INTERVAL_MS = 30_000; // 30s ping cycle
export const WS_PONG_DEADLINE_MS = 10_000; // 10s pong deadline

export interface ActiveConnection {
  subdomain: string;
  socket: MinimalWebSocket;
  userId: string;
}

export interface ActiveSseConnection {
  subdomain: string;
  response: MinimalSseResponse;
  userId: string;
}

const connectionsByTenant = new Map<string, Set<ActiveConnection>>();
const sseConnectionsByTenant = new Map<string, Set<ActiveSseConnection>>();

export function getActiveConnectionsCount(): number {
  let count = 0;
  for (const set of connectionsByTenant.values()) {
    count += set.size;
  }
  for (const set of sseConnectionsByTenant.values()) {
    count += set.size;
  }
  return count;
}

export function getTenantConnections(subdomain: string): Set<ActiveConnection> | undefined {
  return connectionsByTenant.get(subdomain.trim().toLowerCase());
}

export function getTenantSseConnections(subdomain: string): Set<ActiveSseConnection> | undefined {
  return sseConnectionsByTenant.get(subdomain.trim().toLowerCase());
}

/**
 * Registers an active WebSocket connection for a given tenant subdomain and user ID.
 * Returns an unregister function to call when the connection closes.
 */
export function registerConnection(
  subdomain: string,
  socket: MinimalWebSocket,
  userId: string,
): () => void {
  const normSubdomain = subdomain.trim().toLowerCase();
  const connection: ActiveConnection = { subdomain: normSubdomain, socket, userId };

  let tenantSet = connectionsByTenant.get(normSubdomain);
  if (!tenantSet) {
    tenantSet = new Set<ActiveConnection>();
    connectionsByTenant.set(normSubdomain, tenantSet);
  }
  tenantSet.add(connection);

  // Setup heartbeat ping intervals to proactively detect dead sockets
  let pongTimeout: NodeJS.Timeout | null = null;
  const clearPongDeadline = () => {
    if (pongTimeout) {
      clearTimeout(pongTimeout);
      pongTimeout = null;
    }
  };

  const onPong = () => {
    clearPongDeadline();
  };
  socket.on("pong", onPong);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;

    clearInterval(pingInterval);
    clearPongDeadline();

    const currentSet = connectionsByTenant.get(normSubdomain);
    if (currentSet) {
      currentSet.delete(connection);
      if (currentSet.size === 0) {
        connectionsByTenant.delete(normSubdomain);
      }
    }

    if (typeof socket.off === "function") {
      socket.off("pong", onPong);
      socket.off("close", cleanup);
      socket.off("error", onError);
    } else if (typeof socket.removeListener === "function") {
      socket.removeListener("pong", onPong);
      socket.removeListener("close", cleanup);
      socket.removeListener("error", onError);
    }

    logger.info({ userId, subdomain: normSubdomain }, "WS connection closed");
  };

  const onError = (err: Error) => {
    logger.error({ userId, subdomain: normSubdomain, err }, "WS connection error");
    cleanup();
  };

  socket.on("close", cleanup);
  socket.on("error", onError);

  const pingInterval = setInterval(() => {
    try {
      clearPongDeadline();
      pongTimeout = setTimeout(() => {
        logger.warn(
          { userId, subdomain: normSubdomain },
          "WS heartbeat pong deadline expired (10s); terminating stalled socket",
        );
        cleanup();
        socket.terminate();
      }, WS_PONG_DEADLINE_MS);
      if (typeof pongTimeout.unref === "function") {
        pongTimeout.unref();
      }

      socket.ping();
    } catch {
      cleanup();
      socket.terminate();
    }
  }, WS_HEARTBEAT_INTERVAL_MS);
  if (typeof pingInterval.unref === "function") {
    pingInterval.unref();
  }

  logger.info(
    { userId, subdomain: normSubdomain, active: getActiveConnectionsCount() },
    "WS connection registered",
  );
  return cleanup;
}

/**
 * Registers an active SSE (chunked streaming) connection for a given tenant subdomain and user ID.
 * Emits required SSE headers with chunked transfer and zero buffering.
 */
export function registerSseConnection(
  subdomain: string,
  response: MinimalSseResponse,
  userId: string,
): () => void {
  const normSubdomain = subdomain.trim().toLowerCase();
  const connection: ActiveSseConnection = { subdomain: normSubdomain, response, userId };

  let tenantSet = sseConnectionsByTenant.get(normSubdomain);
  if (!tenantSet) {
    tenantSet = new Set<ActiveSseConnection>();
    sseConnectionsByTenant.set(normSubdomain, tenantSet);
  }
  tenantSet.add(connection);

  if (typeof response.writeHead === "function") {
    response.writeHead(200, {
      ...SSE_STREAM_HEADERS,
    });
  } else if (typeof response.setHeader === "function") {
    for (const [key, value] of Object.entries(SSE_STREAM_HEADERS)) {
      response.setHeader(key, value);
    }
  }
  if (typeof response.flushHeaders === "function") {
    response.flushHeaders();
  }

  // Initial connection frame
  response.write(": connected\n\n");

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;

    clearInterval(pingInterval);

    const currentSet = sseConnectionsByTenant.get(normSubdomain);
    if (currentSet) {
      currentSet.delete(connection);
      if (currentSet.size === 0) {
        sseConnectionsByTenant.delete(normSubdomain);
      }
    }

    if (typeof response.off === "function") {
      response.off("close", cleanup);
      response.off("error", cleanup);
    } else if (typeof response.removeListener === "function") {
      response.removeListener("close", cleanup);
      response.removeListener("error", cleanup);
    }

    logger.info({ userId, subdomain: normSubdomain }, "SSE connection closed");
  };

  response.on("close", cleanup);
  response.on("error", cleanup);

  // Keep-alive heartbeat comment every 25s
  const pingInterval = setInterval(() => {
    try {
      response.write(": ping\n\n");
    } catch {
      cleanup();
      response.end();
    }
  }, 25000);
  if (typeof pingInterval.unref === "function") {
    pingInterval.unref();
  }

  logger.info(
    { userId, subdomain: normSubdomain, active: getActiveConnectionsCount() },
    "SSE connection registered",
  );
  return cleanup;
}

/**
 * Closes all active WebSocket and SSE connections across all tenants and clears the maps.
 */
export function closeAllConnections(): void {
  for (const set of connectionsByTenant.values()) {
    for (const connection of set) {
      try {
        connection.socket.terminate();
      } catch {
        // ignore errors on close
      }
    }
  }
  connectionsByTenant.clear();

  for (const set of sseConnectionsByTenant.values()) {
    for (const connection of set) {
      try {
        connection.response.end();
      } catch {
        // ignore errors on close
      }
    }
  }
  sseConnectionsByTenant.clear();
}
