import { describe, expect, it, vi } from "vitest";
import type { FastifyReply } from "fastify";
import { logger } from "../lib/logger.js";
import {
  handleContactWriteError,
  formatContactWriteError,
} from "../routes/tenant/contacts/contactRouteHelpers.js";
import { ContactPermissionError, ContactUniqueFieldError } from "../services/contactService.js";

function createMockReply() {
  const reply: {
    statusCode: number;
    sentData: unknown;
    status: (code: number) => typeof reply;
    send: (data: unknown) => typeof reply;
  } = {
    statusCode: 200,
    sentData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(data: unknown) {
      this.sentData = data;
      return this;
    },
  };
  return reply as unknown as FastifyReply & { statusCode: number; sentData: unknown };
}

describe("handleContactWriteError", () => {
  it("returns 403 on ContactPermissionError", () => {
    const reply = createMockReply();
    handleContactWriteError(reply, new ContactPermissionError("Permission denied"));
    expect(reply.statusCode).toBe(403);
    expect(reply.sentData).toEqual({ type: "forbidden", message: "Permission denied" });
  });

  it("returns 400 on ContactUniqueFieldError", () => {
    const reply = createMockReply();
    const error = new ContactUniqueFieldError([
      { fieldId: "number", tabId: "phones", index: 0, message: "Phone already exists" },
    ]);
    handleContactWriteError(reply, error);
    expect(reply.statusCode).toBe(400);
    expect(reply.sentData).toEqual({
      type: "validation_error",
      message: "Phone already exists",
      errors: [{ fieldId: "number", tabId: "phones", index: 0, message: "Phone already exists" }],
    });
  });

  it("maps Postgres 23505 CNIC unique constraint violation to inline validation error", () => {
    const reply = createMockReply();
    const pgError = {
      code: "23505",
      constraint: "contacts_workspace_cnic_active_uidx",
      detail: "Key ((regexp_replace(cnic, ...)))=(4210112345671) already exists.",
    };
    handleContactWriteError(reply, pgError);
    expect(reply.statusCode).toBe(400);
    expect(reply.sentData).toEqual({
      type: "validation_error",
      message: "CNIC must be unique per contact",
      errors: [{ fieldId: "cnic", tabId: "basic", message: "CNIC must be unique per contact" }],
    });
  });

  it("maps Postgres 23505 Phone unique constraint violation to inline validation error", () => {
    const reply = createMockReply();
    const pgError = {
      code: "23505",
      constraint: "contacts_workspace_phone_active_uidx",
      detail: "Key ((regexp_replace(phone, ...)))=(923001234567) already exists.",
    };
    handleContactWriteError(reply, pgError);
    expect(reply.statusCode).toBe(400);
    expect(reply.sentData).toEqual({
      type: "validation_error",
      message: "Phone number must be unique per contact",
      errors: [
        { fieldId: "number", tabId: "phones", message: "Phone number must be unique per contact" },
      ],
    });
  });

  it("maps Postgres 23505 Email unique constraint violation to inline validation error", () => {
    const reply = createMockReply();
    const pgError = {
      code: "23505",
      constraint: "contacts_workspace_email_active_uidx",
      detail: "Key (lower(trim(email)))=(test@example.com) already exists.",
    };
    handleContactWriteError(reply, pgError);
    expect(reply.statusCode).toBe(400);
    expect(reply.sentData).toEqual({
      type: "validation_error",
      message: "Email address must be unique per contact",
      errors: [
        {
          fieldId: "address",
          tabId: "emails",
          message: "Email address must be unique per contact",
        },
      ],
    });
  });

  it("returns 500 on unexpected errors", () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation((() => {}) as any);
    const reply = createMockReply();
    handleContactWriteError(reply, new Error("Disk failure"));
    expect(reply.statusCode).toBe(500);
    expect(reply.sentData).toEqual({
      type: "database_error",
      message: "Failed to save contact record",
    });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("formatContactWriteError", () => {
  it("formats ContactUniqueFieldError into 400 validation_error response", () => {
    const error = new ContactUniqueFieldError([
      { fieldId: "number", tabId: "phones", index: 0, message: "Phone already exists" },
    ]);
    const res = formatContactWriteError(error, "Fallback message");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      type: "validation_error",
      message: "Phone already exists",
      errors: [{ fieldId: "number", tabId: "phones", index: 0, message: "Phone already exists" }],
    });
  });

  it("formats validation errors into 400 validation_error response", () => {
    const error = {
      statusCode: 400,
      message: "Invalid payload",
      errors: [{ path: "name", message: "Required" }],
    };
    const res = formatContactWriteError(error, "Fallback message");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      type: "validation_error",
      message: "Invalid payload",
      errors: [{ path: "name", message: "Required" }],
    });
  });

  it("formats ContactPermissionError into 403 forbidden response", () => {
    const error = new ContactPermissionError("Permission denied");
    const res = formatContactWriteError(error, "Fallback message");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      type: "forbidden",
      message: "Permission denied",
    });
  });

  it("formats Postgres 23505 unique constraint violations with structured field/tab attribution", () => {
    const pgError = {
      code: "23505",
      constraint: "contacts_workspace_phone_active_uidx",
      detail: "Key ((regexp_replace(phone, ...)))=(923001234567) already exists.",
    };
    const res = formatContactWriteError(pgError, "Fallback message");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      type: "validation_error",
      message: "Phone number must be unique per contact",
      errors: [
        { fieldId: "number", tabId: "phones", message: "Phone number must be unique per contact" },
      ],
    });
  });

  it("formats database / unexpected error into 500 database_error response without leaking the raw message", () => {
    const error = new Error("Database disconnected");
    const res = formatContactWriteError(error, "Fallback message");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      type: "database_error",
      message: "Fallback message",
    });
  });
});
