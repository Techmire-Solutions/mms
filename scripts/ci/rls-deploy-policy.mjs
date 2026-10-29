#!/usr/bin/env node
/**
 * Deploy-time policy for `MMS_DB_ROLE_ENFORCEMENT`.
 *
 * `checkRlsRole` proves whether the connected role is subject to RLS. This
 * policy decides whether the configured *mode* is acceptable for a production
 * deploy:
 *   - strict: always allowed;
 *   - warn:   allowed only with the explicit `MMS_ALLOW_RLS_WARN=1` override;
 *   - off:    allowed only with the explicit `MMS_ALLOW_RLS_OFF=1` override;
 *   - anything else: rejected (fail closed).
 *
 * Keeping this as a pure module (instead of inline shell) makes the failure
 * matrix testable and keeps the deploy script from silently accepting a typo.
 */
import process from "node:process";

/**
 * @param {{ mode: string, allowWarn: string, allowOff: string }} input
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function evaluateRlsDeployPolicy({ mode, allowWarn, allowOff }) {
  if (mode === "strict") return { allowed: true };

  if (mode === "warn") {
    if (allowWarn === "1") {
      return {
        allowed: true,
        reason: "MMS_DB_ROLE_ENFORCEMENT=warn accepted via MMS_ALLOW_RLS_WARN=1",
      };
    }
    return {
      allowed: false,
      reason:
        "MMS_DB_ROLE_ENFORCEMENT=warn — tenant RLS is not enforced. " +
        "Provision mms_app and set strict (docs/rls-operations.md), or set " +
        "MMS_ALLOW_RLS_WARN=1 for a documented exception.",
    };
  }

  if (mode === "off") {
    if (allowOff === "1") {
      return {
        allowed: true,
        reason: "MMS_DB_ROLE_ENFORCEMENT=off accepted via MMS_ALLOW_RLS_OFF=1",
      };
    }
    return {
      allowed: false,
      reason:
        "MMS_DB_ROLE_ENFORCEMENT=off — RLS is explicitly disabled. " +
        "Set strict (docs/rls-operations.md), or set MMS_ALLOW_RLS_OFF=1 for an " +
        "intentional single-tenant install.",
    };
  }

  return {
    allowed: false,
    reason:
      `MMS_DB_ROLE_ENFORCEMENT must be strict, warn or off (got ${JSON.stringify(mode)}). ` +
      "Refusing to deploy with an unknown mode.",
  };
}

function parseArgs(argv) {
  const args = { mode: "", allowWarn: "0", allowOff: "0" };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1] ?? "";
    if (flag === "--mode") {
      args.mode = value;
      i += 1;
    } else if (flag === "--allow-warn") {
      args.allowWarn = value;
      i += 1;
    } else if (flag === "--allow-off") {
      args.allowOff = value;
      i += 1;
    }
  }
  return args;
}

function main() {
  const decision = evaluateRlsDeployPolicy(parseArgs(process.argv.slice(2)));
  if (!decision.allowed) {
    console.error(`[rls-deploy] ${decision.reason}`);
    process.exitCode = 1;
    return;
  }
  if (decision.reason) console.warn(`[rls-deploy] ${decision.reason}`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
