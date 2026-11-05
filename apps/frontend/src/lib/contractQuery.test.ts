import { describe, expect, it } from "vitest";
import { contractBody, isContractQueryError } from "./contractQuery";

describe("contractBody", () => {
  it("returns the body for a 2xx envelope", () => {
    expect(contractBody<{ total: number }>({ status: 200, body: { total: 3 } })).toEqual({
      total: 3,
    });
  });

  it("returns undefined for a non-2xx envelope or a missing response", () => {
    expect(contractBody({ status: 403, body: { message: "Forbidden" } })).toBeUndefined();
    expect(contractBody({ status: 500 })).toBeUndefined();
    expect(contractBody(undefined)).toBeUndefined();
  });
});

describe("isContractQueryError", () => {
  it("is false only when the query and its envelope both succeeded", () => {
    expect(isContractQueryError({ isError: false, data: { status: 200 } })).toBe(false);
    expect(isContractQueryError({ isError: false, data: undefined })).toBe(false);
  });

  it("treats a non-2xx envelope as an error even when the query did not throw", () => {
    // The ts-rest fetcher only throws for 401/403 — a 500 arrives as data.
    expect(isContractQueryError({ isError: false, data: { status: 500 } })).toBe(true);
    expect(isContractQueryError({ isError: true, data: undefined })).toBe(true);
  });
});
