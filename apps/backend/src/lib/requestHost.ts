function isInternalHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host.startsWith("127.")) return true;
  // Any dotted-numeric Host is treated as internal so we may fall back to
  // X-Forwarded-Host (see canTrustForwardedHost). This is safe in development
  // because TRUST_PROXY is restricted to known proxy IPs/CIDRs (serverConfig
  // rejects TRUST_PROXY=true); production additionally requires
  // MMS_TRUST_X_FORWARDED_HOST=true before the header is honoured.
  return /^\d+\.\d+\.\d+\.\d+$/.test(host);
}

export function headerHost(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "")
    .split(":")[0]
    .toLowerCase();
}

/** Whether a client-supplied X-Forwarded-Host may drive tenant resolution. */
function canTrustForwardedHost(): boolean {
  if (process.env.MMS_TRUST_X_FORWARDED_HOST === "true") return true;
  // Development/test keep the Vite/dev-proxy fallback. Production requires the
  // explicit opt-in above: otherwise an attacker who can reach the Node port
  // directly could rotate the tenant (and thus the rate-limit bucket) per
  // request with a forged header.
  return process.env.NODE_ENV !== "production";
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
  if (canTrustForwardedHost()) {
    const fromForwarded = headerHost(request.headers["x-forwarded-host"]);
    if (fromForwarded) {
      return fromForwarded;
    }
  }
  return fromHost || headerHost(request.hostname);
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
