import type { AuthArtifactKind, AuthArtifactRecord } from "./authArtifactService.js";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "./authCookieService.js";

/**
 * Generic OTP challenge lifecycle shared by every tenant/platform OTP flow
 * (2FA login, platform 2FA, tenant password reset, platform password reset) —
 * mms-dry §2.
 *
 * Encoded lifecycle:
 *   createChallenge → generate code → hash → persist artifact
 *   verify          → fetch → normalize whitespace → verifyOtpCode → attempts
 *                     increment → shared ceiling → delete / re-arm
 *   regenerate      → fetch → guard → optional user liveness → fresh code →
 *                     delete + persist (resend re-arm)
 *
 * Flow-specific storage modes (atomic claim, lookup key, in-place update),
 * re-arm TTLs (remaining vs full), and dispatch channels are supplied by the
 * adapter; the console-specific wrappers keep their own delivery policy and
 * error mapping so every external contract stays byte-identical.
 */

export interface OtpChallengePayload {
  codeHash: string;
  attempts: number;
}

export interface OtpDispatchResult {
  sent: boolean;
  devCode?: string;
}

export type OtpVerifyFailureReason = "not_found" | "invalid_code" | "too_many_attempts";

export type OtpVerifyOutcome<TUser, TPayload extends OtpChallengePayload> =
  | { ok: true; entry: AuthArtifactRecord<TPayload>; payload: TPayload; user: TUser | null }
  | { ok: false; reason: OtpVerifyFailureReason };

export type OtpRegenerateOutcome<TUser, TPayload extends OtpChallengePayload> =
  | { ok: true; code: string; payload: TPayload; user: TUser | null }
  | { ok: false; reason: "not_found" };

export type OtpResendOutcome<TPayload extends OtpChallengePayload> =
  | { ok: true; code: string; payload: TPayload; dispatch?: OtpDispatchResult }
  | { ok: false; reason: "not_found" };

export interface OtpChallengeServiceOptions<TUser, TPayload extends OtpChallengePayload> {
  /** Auth-artifact kind used for storage. */
  kind: AuthArtifactKind;
  /** Challenge lifetime. */
  ttlMs: number;
  /** Shared attempt ceiling — the artifact dies at this many failed guesses. */
  maxAttempts: number;
  /** Builds the stored payload (domain fields + codeHash + attempts). */
  buildPayload(user: TUser, codeHash: string): TPayload;
  /**
   * Persists the payload. Must honor `id` for resend re-arms and generate one
   * otherwise. Returns the artifact id.
   */
  persist(payload: TPayload, id?: string): Promise<string>;
  /** Loads the entry for verification (may atomically consume for one-shot flows). */
  loadForVerify(challengeId: string): Promise<AuthArtifactRecord<TPayload> | null>;
  /** Loads the entry for resend (must not consume). */
  loadForResend(challengeId: string): Promise<AuthArtifactRecord<TPayload> | null>;
  /** Re-arms a failed attempt (delete+put remaining/full TTL, or in-place update). */
  rearm(entry: AuthArtifactRecord<TPayload>, payload: TPayload): Promise<void>;
  /** Deletes the artifact (ceiling, success-consumption, failed delivery). */
  remove(entry: AuthArtifactRecord<TPayload>): Promise<void>;
  /** Whether a successful verification must also delete the artifact. */
  consumeOnSuccess?: boolean;
  /** Resolves the domain user after a successful verification (nullable). */
  resolveUserOnSuccess?(payload: TPayload): Promise<TUser | null>;
  /** Optional user liveness check before resending. */
  resolveUserForResend?(entry: AuthArtifactRecord<TPayload>): Promise<TUser | null>;
  /** Fresh-payload builder on resend; defaults to spreading the entry payload. */
  rebuildPayloadForResend?(entry: AuthArtifactRecord<TPayload>, codeHash: string): TPayload;
  /** Delivers a fresh code for a new challenge (optional — void dispatchers call their own). */
  dispatch?(user: TUser, code: string, challengeId?: string): Promise<OtpDispatchResult>;
  /**
   * Resend dispatch override for flows that dispatch from the stored payload
   * (no live user). Defaults to {@link dispatch} when a user was resolved.
   */
  dispatchOnResend?(
    user: TUser | null,
    code: string,
    payload: TPayload,
  ): Promise<OtpDispatchResult>;
}

/** Optional per-call payload guard (e.g. cross-tenant challenge binding). */
export type OtpChallengeGuard<TPayload> = (payload: TPayload) => boolean;

export interface OtpChallengeCreated<TPayload extends OtpChallengePayload> {
  challengeId: string;
  code: string;
  payload: TPayload;
}

export interface OtpIssueOutcome<
  TPayload extends OtpChallengePayload,
> extends OtpChallengeCreated<TPayload> {
  dispatch?: OtpDispatchResult;
}

export function createOtpChallengeService<TUser, TPayload extends OtpChallengePayload>(
  options: OtpChallengeServiceOptions<TUser, TPayload>,
) {
  /** Generates + hashes the code and persists the artifact (no dispatch). */
  async function createChallenge(user: TUser): Promise<OtpChallengeCreated<TPayload>> {
    const code = generateOtpCode();
    const payload = options.buildPayload(user, hashOtpCode(code));
    const challengeId = await options.persist(payload);
    return { challengeId, code, payload };
  }

  /** createChallenge + dispatch — for flows whose dispatcher never throws. */
  async function issue(user: TUser): Promise<OtpIssueOutcome<TPayload>> {
    const created = await createChallenge(user);
    const dispatch = options.dispatch
      ? await options.dispatch(user, created.code, created.challengeId)
      : undefined;
    return { ...created, dispatch };
  }

  /** Raw dispatch for flows that apply their own delivery policy. */
  async function dispatch(
    user: TUser,
    code: string,
    challengeId?: string,
  ): Promise<OtpDispatchResult> {
    if (!options.dispatch) {
      throw new Error("This OTP challenge service has no dispatcher configured");
    }
    return options.dispatch(user, code, challengeId);
  }

  async function verifyEntry(
    entry: AuthArtifactRecord<TPayload>,
    code: string,
    guard?: OtpChallengeGuard<TPayload>,
  ): Promise<OtpVerifyOutcome<TUser, TPayload>> {
    if (guard && !guard(entry.payload)) return { ok: false, reason: "not_found" };

    const normalizedCode = code.replace(/\s/g, "");
    if (verifyOtpCode(normalizedCode, entry.payload.codeHash)) {
      if (options.consumeOnSuccess) await options.remove(entry);
      const user = options.resolveUserOnSuccess
        ? await options.resolveUserOnSuccess(entry.payload)
        : null;
      return { ok: true, entry, payload: entry.payload, user };
    }

    const attempts = (entry.payload.attempts ?? 0) + 1;
    if (attempts >= options.maxAttempts) {
      await options.remove(entry);
      return { ok: false, reason: "too_many_attempts" };
    }
    await options.rearm(entry, { ...entry.payload, attempts });
    return { ok: false, reason: "invalid_code" };
  }

  async function verify(
    challengeId: string,
    code: string,
    guard?: OtpChallengeGuard<TPayload>,
  ): Promise<OtpVerifyOutcome<TUser, TPayload>> {
    const entry = await options.loadForVerify(challengeId);
    if (!entry) return { ok: false, reason: "not_found" };
    return verifyEntry(entry, code, guard);
  }

  /** Resend re-arm without dispatch — flows with throwing dispatchers use this. */
  async function regenerate(
    challengeId: string,
    guard?: OtpChallengeGuard<TPayload>,
  ): Promise<OtpRegenerateOutcome<TUser, TPayload>> {
    const entry = await options.loadForResend(challengeId);
    if (!entry) return { ok: false, reason: "not_found" };
    if (guard && !guard(entry.payload)) return { ok: false, reason: "not_found" };

    let user: TUser | null = null;
    if (options.resolveUserForResend) {
      user = await options.resolveUserForResend(entry);
      if (!user) return { ok: false, reason: "not_found" };
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(code);
    const payload = options.rebuildPayloadForResend
      ? options.rebuildPayloadForResend(entry, codeHash)
      : ({ ...entry.payload, codeHash, attempts: 0 } as TPayload);
    await options.remove(entry);
    await options.persist(payload, challengeId);
    return { ok: true, code, payload, user };
  }

  async function resend(
    challengeId: string,
    guard?: OtpChallengeGuard<TPayload>,
  ): Promise<OtpResendOutcome<TPayload>> {
    const regenerated = await regenerate(challengeId, guard);
    if (!regenerated.ok) return regenerated;
    const dispatch = options.dispatchOnResend
      ? await options.dispatchOnResend(regenerated.user, regenerated.code, regenerated.payload)
      : regenerated.user && options.dispatch
        ? await options.dispatch(regenerated.user, regenerated.code, challengeId)
        : undefined;
    return {
      ok: true,
      code: regenerated.code,
      payload: regenerated.payload,
      dispatch,
    };
  }

  return { createChallenge, issue, dispatch, verify, verifyEntry, regenerate, resend };
}

export type OtpChallengeService<TUser, TPayload extends OtpChallengePayload> = ReturnType<
  typeof createOtpChallengeService<TUser, TPayload>
>;
