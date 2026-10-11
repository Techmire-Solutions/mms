function isInternalHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host.startsWith("127.")) return true;
  // Any dotted-numeric Host is treated as internal so we fall back to
  // X-Forwarded-Host. This is safe because TRUST_PROXY is restricted to known
  // proxy IPs/CIDRs (serverConfig rejects TRUST_PROXY=true), so a public-IP Host
  // header cannot be used to spoof the tenant subdomain.
  return /^\d+\.\d+\.\d+\.\d+$/.test(host);
}

export function headerHost(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "")
    .split(":")[0]
    .toLowerCase();
}

/** Prefer Host from ProxyPreserveHost; use X-Forwarded-Host only for dev/internal proxies. */
export function requestHostname(request: {
  hostname: string;
  headers: Record<string, unknown>;
}): string {
  const fromHost = headerHost(request.headers.host);
  if (!isInternalHost(fromHost)) {
    return fromHost;
  }
  const fromForwarded = headerHost(request.headers["x-forwarded-host"]);
  if (fromForwarded) {
    return fromForwarded;
  }
  return headerHost(request.hostname);
}

function headerValue(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed || undefined;
}

/**
 * Best-effort trusted origin (scheme + host + port) for building links back into the
 * app (e.g. emailed invite links) — the CSRF/origin guard already validates this exact
 * header on mutation requests, so it is safe to trust here. Falls back to the Referer's
 * origin, then `undefined` if neither is present.
 */
export function resolveRequestOrigin(request: {
  headers: Record<string, unknown>;
}): string | undefined {
  const origin = headerValue(request.headers.origin);
  if (origin) return origin;

  const referer = headerValue(request.headers.referer);
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
