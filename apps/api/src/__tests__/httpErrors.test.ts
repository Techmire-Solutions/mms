import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyReply } from "fastify";

vi.mock("../lib/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  mapConstraintError,
  sendDatabaseError,
  sendIfHttpDomainError,
  ConflictError,
} from "../lib/httpErrors.js";
import { replyValidationError } from "../lib/zodRequest.js";

/** Minimal stand-in for the replies the helpers act on. */
function fakeReply() {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
    request: { id: "req-1", url: "/api/accounting/entries" },
  };
  reply.status.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);
  return reply as unknown as FastifyReply & typeof reply;
}

/** A drizzle-wrapped driver error: the SQLSTATE and message live on the cause. */
function wrappedPgError(code: string, message: string): Error {
  return new Error(`Failed query: insert into "accounting_entries" …`, {
    cause: Object.assign(new Error(message), { code }),
  });
}

describe("sendDatabaseError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a ledger-guard check violation to 422 with the guard's own message", () => {
    // The 0248/0249 triggers raise check_violation with the real reason. Collapsing
    // that into the generic 400 lost both the reason and the 422 class the use-case
    // guards use for the same rejection.
    const reply = fakeReply();
    sendDatabaseError(
      reply,
      "Failed to post",
      wrappedPgError("23514", "Posted journal entry je-1 is unbalanced: 100 debit vs 90 credit"),
    );

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith({
      type: "ledger_guard",
      message: "Posted journal entry je-1 is unbalanced: 100 debit vs 90 credit",
    });
  });

  it("recognises a closed-posting-period rejection", () => {
    const reply = fakeReply();
    sendDatabaseError(
      reply,
      "Failed to post",
      wrappedPgError("23514", "Journal entry je-2 is dated inside closed posting period pp-1"),
    );
    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ type: "ledger_guard" }));
  });

  it("keeps an unrelated check violation as the generic 400", () => {
    const reply = fakeReply();
    sendDatabaseError(
      reply,
      "Failed to save",
      wrappedPgError("23514", "Account code must be uppercase"),
    );
    expect(reply.status).toHaveBeenCalledWith(400);
    // Mapped codes keep the caller's operation description, never DB internals.
    expect(reply.send).toHaveBeenCalledWith({
      type: "constraint_violation",
      message: "Failed to save",
    });
  });

  it("maps a unique violation to 409 and an unknown failure to a non-leaking 500", () => {
    const conflict = fakeReply();
    sendDatabaseError(conflict, "Failed to save", wrappedPgError("23505", "duplicate key"));
    expect(conflict.status).toHaveBeenCalledWith(409);

    const server = fakeReply();
    sendDatabaseError(server, "Failed to save", new Error("connection terminated"));
    expect(server.status).toHaveBeenCalledWith(500);
    expect(server.send).toHaveBeenCalledWith({
      type: "database_error",
      message: "Failed to save",
    });
  });
});

describe("mapConstraintError", () => {
  it("maps the ledger guard for contract handlers too", () => {
    const mapped = mapConstraintError(
      wrappedPgError("23514", "Lines of posted journal entry je-1 are immutable — post a reversal"),
    );
    expect(mapped).toEqual({
      status: 422,
      body: {
        type: "ledger_guard",
        message: "Lines of posted journal entry je-1 are immutable — post a reversal",
      },
    });
  });

  it("returns null for an error that is not a PostgreSQL constraint", () => {
    expect(mapConstraintError(new Error("boom"))).toBeNull();
  });
});

describe("sendIfHttpDomainError", () => {
  it("keeps the domain status and envelope", () => {
    const reply = fakeReply();
    sendIfHttpDomainError(reply, new ConflictError("Journal JV-1 is already reversed by RV-1"));
    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith({
      type: "conflict",
      message: "Journal JV-1 is already reversed by RV-1",
    });
  });

  it("returns null for a server error so the caller can fall back", () => {
    expect(sendIfHttpDomainError(fakeReply(), new Error("boom"))).toBeNull();
  });
});

describe("replyValidationError", () => {
  it("carries field-level issues in details while keeping the shared envelope", () => {
    const reply = fakeReply();
    replyValidationError(reply, {
      message: 'Unrecognized key: "deleteOriginal"',
      issues: [{ path: "(root)", message: 'Unrecognized key: "deleteOriginal"' }],
    });
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      type: "validation_error",
      message: 'Unrecognized key: "deleteOriginal"',
      details: { issues: [{ path: "(root)", message: 'Unrecognized key: "deleteOriginal"' }] },
    });
  });

  it("still accepts a plain message", () => {
    const reply = fakeReply();
    replyValidationError(reply, "Invalid request");
    expect(reply.send).toHaveBeenCalledWith({
      type: "validation_error",
      message: "Invalid request",
    });
  });
});
