/** WebSocket connection caps: bound per-user fan-out and per-tenant socket count. */
export const MAX_WS_CONNECTIONS_PER_USER = 5;
export const MAX_WS_CONNECTIONS_PER_TENANT = 500;

export type ConnectionCapViolation = "tenant" | "user";

/**
 * Returns which cap a new connection would violate, or null when it fits.
 * `connections` is the tenant's current set; each entry carries its `userId`.
 */
export function connectionCapViolation(
  connections: ReadonlySet<{ userId: string }> | undefined,
  userId: string,
): ConnectionCapViolation | null {
  if (!connections) return null;
  if (connections.size >= MAX_WS_CONNECTIONS_PER_TENANT) return "tenant";
  let userConnections = 0;
  for (const connection of connections) {
    if (connection.userId === userId) userConnections += 1;
  }
  return userConnections >= MAX_WS_CONNECTIONS_PER_USER ? "user" : null;
}
