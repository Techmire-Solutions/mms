import { describe, expect, it } from "vitest";
import { dependencyForDiagnosticStage } from "../lib/requestDiagnostics.js";

describe("request diagnostics", () => {
  it.each([
    ["authentication_workspace_lookup", "database"],
    ["load_user", "database"],
    ["credential_update", "database"],
    ["refresh_token_revocation", "database"],
    ["authentication_tenant_blocklist", "redis"],
    ["authentication_token_revocation", "redis"],
    ["authentication_user_session_revocation", "redis"],
    ["session_revocation", "redis"],
    ["password_hash", "crypto"],
    ["rate_limit", "rate_limiter"],
  ])("maps %s to %s", (stage, dependency) => {
    expect(dependencyForDiagnosticStage(stage)).toBe(dependency);
  });

  it("does not guess a dependency for an unknown stage", () => {
    expect(dependencyForDiagnosticStage("response_serialization")).toBeUndefined();
  });
});
