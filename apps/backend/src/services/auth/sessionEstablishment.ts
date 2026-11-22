import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { JWT } from "@fastify/jwt";
import { resetSessionClock } from "../sessionClockService.js";

/**
 * Shared session-establishment sequence for both consoles (mms-dry §2):
 * mint jti → sign JWT → mint refresh token (tenant) → clear the other domain's
 * cookies → set this domain's cookies → reset the session clock.
 *
 * Tenant (`authService.establishSession`) and platform
 * (`platformAuthService.issuePlatformSession`) used to implement this sequence
 * independently; only the claims, cookie plans, and clock scope differ.
 */

export interface EstablishSessionPlan {
  domain: "tenant" | "platform";
  jwtSigner: JWT;
  reply: FastifyReply;
  /** Claims signed into the access token (the helper appends `jti`). */
  claims: Record<string, unknown>;
  /** Access-token lifetime passed to `jwtSigner.sign` `expiresIn`. */
  expiresIn: string | number;
  /** Tenant-only: mints and persists the refresh-token artifact. */
  refreshTokenProvider?: () => Promise<string>;
  /** Clears the other console's cookies. */
  clearOtherDomainCookies: () => void;
  /** Sets this console's access (and optional refresh) cookies. */
  setDomainCookies: (accessToken: string, refreshToken?: string) => void;
  /** Precomputed session-clock scope. */
  sessionScope: string;
  /** Precomputed idle window for the clock reset. */
  idleMs: number;
}

export async function establishSession(plan: EstablishSessionPlan): Promise<void> {
  const jti = randomUUID();
  const accessToken = plan.jwtSigner.sign({ ...plan.claims, jti }, { expiresIn: plan.expiresIn });
  const refreshToken = plan.refreshTokenProvider ? await plan.refreshTokenProvider() : undefined;
  plan.clearOtherDomainCookies();
  plan.setDomainCookies(accessToken, refreshToken);
  await resetSessionClock(plan.sessionScope, plan.idleMs);
}
