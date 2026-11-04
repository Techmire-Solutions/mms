import { beforeEach, describe, expect, it, vi } from "vitest";

const artifactState = vi.hoisted(() => ({
  find: vi.fn(),
  claim: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  findAuthArtifactByLookupKey: (...args: unknown[]) => artifactState.find(...args),
  tryClaimAuthArtifactByLookupKey: (...args: unknown[]) => artifactState.claim(...args),
  updateAuthArtifactPayload: (...args: unknown[]) => artifactState.update(...args),
  deleteAuthArtifact: (...args: unknown[]) => artifactState.remove(...args),
  authArtifactUserScopeKey: (userId: string) => `user:${userId}`,
  authArtifactWorkspaceScopeKey: (subdomain: string) => `ws:${subdomain}`,
}));

import {
  MESSAGING_IDEMPOTENCY_TTL_MS,
  idempotencyBodyMatches,
  messagingDispatchBodyDigest,
  withMessagingIdempotency,
  type MessagingDispatchPayload,
} from "../routes/tenant/messaging/messagingLogIdempotency.js";

const DIGEST = "d".repeat(64);

function payloadFixture(
  overrides: Partial<MessagingDispatchPayload> = {},
): MessagingDispatchPayload {
  return {
    response: { sentCount: 2, failedCount: 0, total: 2 },
    bodyDigest: DIGEST,
    ...overrides,
  };
}

/** Shared flow shape so `P` is inferred as the dispatch payload, not a literal. */
function dispatchFlow(run: () => Promise<unknown>) {
  return {
    claim: { response: null, bodyDigest: DIGEST } as MessagingDispatchPayload,
    complete: (summary: unknown): MessagingDispatchPayload => ({
      response: summary as MessagingDispatchPayload["response"],
      bodyDigest: DIGEST,
    }),
    completedBody: (payload: MessagingDispatchPayload) =>
      payload.response ? { ...payload.response } : null,
    run,
  };
}

describe("messaging idempotency", () => {
  beforeEach(() => {
    artifactState.find.mockReset().mockResolvedValue(null);
    artifactState.claim.mockReset().mockResolvedValue({ claimed: true, id: "art-1" });
    artifactState.update.mockReset().mockResolvedValue(undefined);
    artifactState.remove.mockReset().mockResolvedValue(undefined);
  });

  it("derives a canonical body digest independent of key order", () => {
    const a = messagingDispatchBodyDigest({
      message: "hi",
      recipients: [{ id: "1" }],
      category: "general",
    });
    const b = messagingDispatchBodyDigest({
      category: "general",
      recipients: [{ id: "1" }],
      message: "hi",
    });
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(b);
  });

  it("compares digests in constant time and rejects different values", () => {
    expect(idempotencyBodyMatches({ bodyDigest: "a".repeat(64) }, "a".repeat(64))).toBe(true);
    expect(idempotencyBodyMatches({ bodyDigest: "a".repeat(64) }, "b".repeat(64))).toBe(false);
    expect(idempotencyBodyMatches({ bodyDigest: "a".repeat(64) }, "a".repeat(63))).toBe(false);
  });

  it("replays a completed response without running the side effect", async () => {
    artifactState.find.mockResolvedValue({
      id: "art-1",
      kind: "messaging_idempotency",
      payload: payloadFixture(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const run = vi.fn();

    const result = await withMessagingIdempotency({
      tenantId: "demo",
      userId: "u-1",
      clientKey: "key-1",
      bodyDigest: "d".repeat(64),
      flow: dispatchFlow(run),
    });

    expect(result.status).toBe(200);
    expect(result.replayed).toBe(true);
    expect(result.body).toEqual({ sentCount: 2, failedCount: 0, total: 2 });
    expect(run).not.toHaveBeenCalled();
    expect(artifactState.claim).not.toHaveBeenCalled();
  });

  it("reclaims a stale in-flight claim instead of blocking the request for the TTL", async () => {
    // Claimed 20 minutes ago: past the 5-minute stale window.
    const expiresAt = new Date(Date.now() + MESSAGING_IDEMPOTENCY_TTL_MS - 20 * 60 * 1000);
    artifactState.find.mockResolvedValue({
      id: "art-stale",
      kind: "messaging_idempotency",
      payload: { response: null, bodyDigest: "d".repeat(64) },
      expiresAt,
    });
    const run = vi.fn().mockResolvedValue({ sentCount: 1, failedCount: 0, total: 1 });

    const result = await withMessagingIdempotency({
      tenantId: "demo",
      userId: "u-1",
      clientKey: "key-stale",
      bodyDigest: "d".repeat(64),
      flow: dispatchFlow(run),
    });

    expect(artifactState.remove).toHaveBeenCalledWith("art-stale");
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
    expect(result.replayed).toBe(false);
  });

  it("waits for a fresh in-flight claim and reports it as still in progress", async () => {
    artifactState.find.mockResolvedValue({
      id: "art-fresh",
      kind: "messaging_idempotency",
      payload: { response: null, bodyDigest: "d".repeat(64) },
      expiresAt: new Date(Date.now() + MESSAGING_IDEMPOTENCY_TTL_MS),
    });
    const run = vi.fn();

    const result = await withMessagingIdempotency({
      tenantId: "demo",
      userId: "u-1",
      clientKey: "key-fresh",
      bodyDigest: "d".repeat(64),
      flow: dispatchFlow(run),
    });

    expect(result.status).toBe(409);
    expect(result.body).toEqual({
      type: "conflict",
      message: "Idempotent request still in progress",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects a key reused with a different body digest", async () => {
    artifactState.find.mockResolvedValue({
      id: "art-1",
      kind: "messaging_idempotency",
      payload: payloadFixture({ bodyDigest: "e".repeat(64) }),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const run = vi.fn();

    const result = await withMessagingIdempotency({
      tenantId: "demo",
      userId: "u-1",
      clientKey: "key-mismatch",
      bodyDigest: "d".repeat(64),
      flow: dispatchFlow(run),
    });

    expect(result.status).toBe(409);
    expect(result.body).toEqual({
      type: "conflict",
      message: "Idempotency key reused with a different request body",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("releases the claim when the side effect throws so a retry can run", async () => {
    const run = vi.fn().mockRejectedValue(new Error("gateway down"));

    await expect(
      withMessagingIdempotency({
        tenantId: "demo",
        userId: "u-1",
        clientKey: "key-fail",
        bodyDigest: "d".repeat(64),
        flow: dispatchFlow(run),
      }),
    ).rejects.toThrow("gateway down");

    expect(artifactState.remove).toHaveBeenCalledWith("art-1");
    expect(artifactState.update).not.toHaveBeenCalled();
  });
});
