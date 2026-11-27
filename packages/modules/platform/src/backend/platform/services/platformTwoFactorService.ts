import {
  PLATFORM_OTP_MAX_ATTEMPTS,
  TWO_FACTOR_CHALLENGE_TTL_MS,
  type StoredPlatformUser,
} from "@mms/contracts";
import {
  createArtifactId,
  deleteAuthArtifact,
  getAuthArtifact,
  putAuthArtifact,
  takeAuthArtifact,
} from "../deps.js";
import {
  createOtpChallengeService,
  type OtpChallengePayload,
  type OtpDispatchResult,
} from "../deps.js";
import { getStoredPlatformUserById } from "./platformUserService.js";
import { dispatchPlatformOtpAcrossChannels } from "./platformOtpDispatch.js";

const CHALLENGE_TTL_MS = TWO_FACTOR_CHALLENGE_TTL_MS;

export interface PlatformTwoFactorChallengePayload extends OtpChallengePayload {
  userId: string;
}

/** True when platform login requires an OTP step (opt-in via env). */
export function isPlatformTwoFactorRequired(): boolean {
  return process.env.PLATFORM_REQUIRE_2FA === "true";
}

/**
 * Delivers a platform 2FA code via the shared channel-fallback dispatcher:
 * SMS when the resolved channel allows it and the admin has a phone, email
 * otherwise.
 */
async function dispatchPlatformTwoFactorCode(
  user: StoredPlatformUser,
  code: string,
): Promise<OtpDispatchResult> {
  return dispatchPlatformOtpAcrossChannels({
    email: user.email,
    phone: user.phone,
    code,
    ttlMinutes: CHALLENGE_TTL_MS / 60_000,
    logLabel: "Platform 2FA code",
    smsBody: `Your MMS platform verification code is ${code}. It expires in ${CHALLENGE_TTL_MS / 60_000} minutes.`,
    smsFailWarnMessage: "platform 2FA SMS dispatch failed",
    smsFailLogLabel: "Platform 2FA code",
    emailSubject: "Your MMS platform verification code",
    emailBodyLines: ["Use this verification code to finish signing in to the MMS platform:"],
  });
}

async function resolvePlatformUser(payload: PlatformTwoFactorChallengePayload) {
  const user = await getStoredPlatformUserById(payload.userId);
  if (!user || user.disabledAt) return null;
  return user;
}

let platformTwoFactorChallengesInstance: ReturnType<typeof createOtpChallengeService> | null = null;
function platformTwoFactorChallengesRuntime() {
  return (platformTwoFactorChallengesInstance ??= createOtpChallengeService<
    StoredPlatformUser,
    PlatformTwoFactorChallengePayload
  >({
    kind: "platform_two_factor_challenge",
    ttlMs: CHALLENGE_TTL_MS,
    maxAttempts: PLATFORM_OTP_MAX_ATTEMPTS,
    buildPayload: (user: any, codeHash: any) => ({ userId: user.id, codeHash, attempts: 0 }),
    persist: async (payload: any, id: any) => {
      const target = id ?? createArtifactId();
      await putAuthArtifact("platform_two_factor_challenge", payload, CHALLENGE_TTL_MS, target);
      return target;
    },
    loadForVerify: (challengeId: any) =>
      takeAuthArtifact<PlatformTwoFactorChallengePayload>(
        challengeId,
        "platform_two_factor_challenge",
      ),
    loadForResend: (challengeId: any) =>
      getAuthArtifact<PlatformTwoFactorChallengePayload>(
        challengeId,
        "platform_two_factor_challenge",
      ),
    // takeAuthArtifact already deleted the row; a plain re-put with the full TTL
    // re-arms the (single-use) challenge with the incremented counter.
    rearm: async (entry: any, payload: any) => {
      await putAuthArtifact("platform_two_factor_challenge", payload, CHALLENGE_TTL_MS, entry.id);
    },
    remove: (entry: any) => deleteAuthArtifact(entry.id),
    resolveUserOnSuccess: resolvePlatformUser,
    resolveUserForResend: (entry: any) => resolvePlatformUser(entry.payload),
    dispatch: (user: any, code: any) => dispatchPlatformTwoFactorCode(user, code),
  }));
}

/**
 * Creates an OTP challenge for a platform login and dispatches the code.
 * Returns the challenge id, or null if the code could not be delivered.
 */
export async function createPlatformTwoFactorChallenge(
  user: StoredPlatformUser,
): Promise<string | null> {
  const { challengeId, dispatch } = await platformTwoFactorChallengesRuntime().issue(user);

  if (!dispatch?.sent && process.env.NODE_ENV === "production") {
    await takeAuthArtifact(challengeId, "platform_two_factor_challenge");
    return null;
  }

  return challengeId;
}

/**
 * Regenerates the OTP for an existing platform 2FA challenge and re-dispatches it.
 * Resets the attempt counter. Returns ok=false when the challenge is missing/expired
 * or the code could not be delivered in production.
 */
export async function resendPlatformTwoFactorChallenge(
  challengeId: string,
): Promise<{ ok: boolean; devCode?: string }> {
  const outcome = await platformTwoFactorChallengesRuntime().resend(challengeId);
  if (!outcome.ok) return { ok: false };

  if (!outcome.dispatch?.sent && process.env.NODE_ENV === "production") {
    await deleteAuthArtifact(challengeId);
    return { ok: false };
  }

  return { ok: true, devCode: outcome.dispatch?.devCode };
}

/**
 * Verifies an OTP against a platform 2FA challenge. Consumes the challenge on
 * success; on repeated failures the challenge is invalidated.
 */
export async function verifyPlatformTwoFactorChallenge(
  challengeId: string,
  code: string,
): Promise<StoredPlatformUser | null> {
  const outcome = await platformTwoFactorChallengesRuntime().verify(challengeId, code);
  return outcome.ok && outcome.user ? outcome.user : null;
}
