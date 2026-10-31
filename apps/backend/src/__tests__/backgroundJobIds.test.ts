import { describe, expect, it } from "vitest";
import {
  BACKGROUND_JOB_ID_MAX_LENGTH,
  BackgroundJobIdValidationError,
  buildBackgroundJobId,
} from "../lib/backgroundJobIds.js";

describe("buildBackgroundJobId", () => {
  it("namespaces a client key with tenant and user", () => {
    const id = buildBackgroundJobId("Acme", "user-1", "export-key-1");

    expect(id).toBe("acme:user-1:export-key-1");
    expect(id.split(":")).toHaveLength(3);
  });

  it("is deterministic for the same tenant/user/key", () => {
    expect(buildBackgroundJobId("acme", "user-1", "same-key")).toBe(
      buildBackgroundJobId("acme", "user-1", "same-key"),
    );
  });

  it("isolates identical client keys per tenant and per user", () => {
    const key = "client-key-1";
    expect(buildBackgroundJobId("alpha", "user-1", key)).not.toBe(
      buildBackgroundJobId("beta", "user-1", key),
    );
    expect(buildBackgroundJobId("alpha", "user-1", key)).not.toBe(
      buildBackgroundJobId("alpha", "user-2", key),
    );
  });

  it("returns a random UUID when no client key is supplied", () => {
    const id = buildBackgroundJobId("acme", "user-1");
    const another = buildBackgroundJobId("acme", "user-1", "   ");

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(another).not.toBe(id);
    expect(another.split(":")).toHaveLength(1);
  });

  it("rejects keys containing the namespace separator", () => {
    expect(() => buildBackgroundJobId("acme", "user-1", "a:b:c")).toThrow(
      BackgroundJobIdValidationError,
    );
  });

  it("rejects a missing tenant or user segment", () => {
    expect(() => buildBackgroundJobId("", "user-1", "key-1")).toThrow(
      BackgroundJobIdValidationError,
    );
    expect(() => buildBackgroundJobId("acme", " ", "key-1")).toThrow(
      BackgroundJobIdValidationError,
    );
  });

  it("rejects ids longer than the storage limit", () => {
    expect(() =>
      buildBackgroundJobId("acme", "user-1", "k".repeat(BACKGROUND_JOB_ID_MAX_LENGTH)),
    ).toThrow(BackgroundJobIdValidationError);
  });
});
