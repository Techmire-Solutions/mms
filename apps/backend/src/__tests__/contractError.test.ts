import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { handleContractError } from "../lib/contractError.js";

type FakeRequest = Parameters<typeof handleContractError>[0];

function fakeRequest() {
  const log = { error: vi.fn(), warn: vi.fn() };
  return { request: { url: "/api/students/x", log } as unknown as FakeRequest, log };
}

const fallback = {
  status: 500,
  body: { type: "database_error", message: "Failed to load" },
};

describe("handleContractError", () => {
  it("logs the cause with request context before answering the fallback", () => {
    // ts-rest handlers bypass the Fastify error pipeline, so a bare `catch { return 500 }`
    // makes production failures undiagnosable. This is the single seam that keeps the stack.
    const { request, log } = fakeRequest();
    const error = new Error("connection terminated");

    const result = handleContractError(request, error, fallback);

    expect(log.error).toHaveBeenCalledWith(
      { err: error, url: "/api/students/x" },
      "Failed to load",
    );
    expect(result).toEqual({ status: 500, body: fallback.body });
  });

  it("maps a Zod failure to 400 instead of mislabelling it a database error", () => {
    const { request } = fakeRequest();
    const error = new ZodError([{ code: "custom", path: ["status"], message: "Invalid status" }]);

    const result = handleContractError(request, error, fallback);

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ type: "validation_error" });
  });

  it("preserves an intentional domain status over the caller's fallback", () => {
    const { request, log } = fakeRequest();
    const error = Object.assign(new Error("Restoring deleted students requires delete"), {
      statusCode: 403,
      type: "forbidden",
    });

    const result = handleContractError(request, error, fallback);

    expect(result.status).toBe(403);
    expect(result.body.type).toBe("forbidden");
    // Expected rejections are logged as warnings, not errors.
    expect(log.warn).toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("surfaces the full-section details in the envelope", () => {
    const { request } = fakeRequest();
    const error = Object.assign(new Error("The class is full"), {
      statusCode: 409,
      type: "class_full",
      sectionId: "sec-1",
      seatsLeft: 0,
    });

    const result = handleContractError(request, error, fallback);

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({
      type: "class_full",
      details: { sectionId: "sec-1", seatsLeft: 0 },
    });
  });

  it("preserves the structured details and violations a domain error carries", () => {
    const { request } = fakeRequest();
    const error = Object.assign(new Error("Below the exam attendance threshold"), {
      statusCode: 409,
      type: "exam_eligibility_blocked",
      details: {
        examId: "e-1",
        students: [{ examId: "e-1", studentId: "s-1", state: "blocked" }],
      },
      violations: ["attendance: 40 < 75"],
    });

    const result = handleContractError(request, error, fallback);

    expect(result).toEqual({
      status: 409,
      body: {
        type: "exam_eligibility_blocked",
        message: "Below the exam attendance threshold",
        details: {
          examId: "e-1",
          students: [{ examId: "e-1", studentId: "s-1", state: "blocked" }],
        },
        violations: ["attendance: 40 < 75"],
      },
    });
  });

  it("maps a unique-violation constraint to 409 instead of a server fault", () => {
    const { request } = fakeRequest();
    const error = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
    });

    const result = handleContractError(request, error, fallback);

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({ type: "conflict" });
  });

  it("maps a check-trigger rejection to 400", () => {
    const { request } = fakeRequest();
    const error = Object.assign(new Error("check constraint violated"), { code: "23514" });

    const result = handleContractError(request, error, fallback);

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ type: "constraint_violation" });
  });
});
