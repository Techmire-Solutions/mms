import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/** True when `ip` is a private / link-local / loopback / reserved address. */
export function isBlockedIp(ip: string): boolean {
  const ipVersion = isIP(ip);
  if (ipVersion === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (ipVersion === 6) {
    return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:");
  }
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "metadata.google.internal") return true;
  return isBlockedIp(host);
}

/**
 * Defends against DNS-rebinding SSRF: resolves `hostname` and rejects it if any
 * resolved address is private / link-local / loopback. Fail-closed on resolution
 * errors so a rebinding target can never be reached silently.
 */
export async function assertSafeExternalHostname(hostname: string): Promise<void> {
  if (isBlockedHostname(hostname)) {
    throw new Error("host is not allowed");
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error("host could not be resolved safely");
  }
  if (addresses.length === 0) {
    throw new Error("host could not be resolved safely");
  }
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new Error("host resolves to a blocked address");
    }
  }
}

export function safeExternalHttpUrl(raw: string, label = "URL"): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid HTTP(S) URL`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`${label} host is not allowed`);
  }
  return parsed.toString().replace(/\/$/, "");
}

export function safeOptionalExternalHttpUrl(
  raw: string | undefined,
  label = "URL",
): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? safeExternalHttpUrl(trimmed, label) : undefined;
}

export const OUTBOUND_FETCH_TIMEOUT_MS = 15_000;

export function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(OUTBOUND_FETCH_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetch(url, {
    ...init,
    signal,
  });
}

/**
 * SSRF-safe outbound fetch: validates the URL, resolves the hostname and rejects
 * private / link-local targets (DNS-rebinding defense), then fetches with a timeout.
 */
export async function fetchSafeExternal(url: string, init?: RequestInit): Promise<Response> {
  await assertSafeExternalHostname(new URL(url).hostname);
  return fetchWithTimeout(url, init);
}
