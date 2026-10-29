import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_WS_CONNECTIONS_PER_TENANT,
  MAX_WS_CONNECTIONS_PER_USER,
  closeAllConnections,
  registerConnection,
  type MinimalWebSocket,
} from "../lib/livePush.js";

function createSocket(): MinimalWebSocket {
  return {
    close: () => {},
    terminate: () => {},
    ping: () => {},
    send: () => {},
    on: () => {},
    off: () => {},
  };
}

/**
 * F43: live-push sockets had no ceiling at all. A single authenticated user
 * could open unbounded sockets (each with its own 30s ping timer), and one
 * tenant could exhaust the process. `registerConnection` now refuses at the
 * cap so the route can close with 1013.
 */
describe("live push connection caps", () => {
  afterEach(() => {
    closeAllConnections();
  });

  it("refuses a user's sixth connection but allows another user", () => {
    const cleanups: Array<() => void> = [];
    for (let index = 0; index < MAX_WS_CONNECTIONS_PER_USER; index += 1) {
      const cleanup = registerConnection("alpha", createSocket(), "user-1");
      expect(cleanup).not.toBeNull();
      if (cleanup) cleanups.push(cleanup);
    }

    expect(registerConnection("alpha", createSocket(), "user-1")).toBeNull();

    const otherUser = registerConnection("alpha", createSocket(), "user-2");
    expect(otherUser).not.toBeNull();

    for (const cleanup of cleanups) cleanup();
    otherUser?.();
  });

  it("refuses a tenant's 501st connection but allows another tenant", () => {
    const cleanups: Array<() => void> = [];
    for (let index = 0; index < MAX_WS_CONNECTIONS_PER_TENANT; index += 1) {
      const cleanup = registerConnection("alpha", createSocket(), `user-${index}`);
      expect(cleanup).not.toBeNull();
      if (cleanup) cleanups.push(cleanup);
    }

    expect(registerConnection("alpha", createSocket(), "user-overflow")).toBeNull();

    const otherTenant = registerConnection("beta", createSocket(), "user-beta");
    expect(otherTenant).not.toBeNull();

    for (const cleanup of cleanups) cleanup();
    otherTenant?.();
  });
});
