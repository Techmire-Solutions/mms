/**
 * Canonical auth token & challenge TTL constants shared by the tenant and
 * platform backends (single source of truth — mms-dry §2).
 *
 * These values are part of the external API contract (cookie `maxAge`, JWT
 * `exp`, challenge lifetimes), so both consoles must derive them from here
 * instead of re-spelling them locally.
 */

/** Lifetime of a two-factor (OTP) challenge artifact — 10 minutes. */
export const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000;

/** Tenant access-token (JWT) lifetime in seconds — 15 minutes. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Tenant refresh-token lifetime in seconds — 7 days. */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Platform access-token (JWT) lifetime in seconds — 8 hours.
 *
 * Previously spelled `"8h"` at the JWT sign site and `8 * 60 * 60 + 300` at
 * the logout revocation site; both are this single TTL (the +300 is the
 * grace margin below, not a second TTL).
 */
export const PLATFORM_ACCESS_TOKEN_TTL_SECONDS = 8 * 60 * 60;

/**
 * Clock-skew grace margin added on top of {@link PLATFORM_ACCESS_TOKEN_TTL_SECONDS}
 * when persisting a token revocation record, so the revocation always outlives
 * the token even when server clocks drift slightly apart.
 */
export const PLATFORM_ACCESS_TOKEN_REVOKE_GRACE_SECONDS = 300;
