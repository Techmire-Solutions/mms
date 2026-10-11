export function secureCookieBase() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    path: "/",
    httpOnly: true,
    secure: isProd || process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
  };
}
