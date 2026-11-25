/**
 * Typed Vite env — validate at module load for fail-fast in misconfigured deploys.
 */
const raw = import.meta.env;

export const env = {
  mode: raw.MODE as string,
  isDev: raw.DEV as boolean,
  isProd: raw.PROD as boolean,
  /** Relative path ('') in production or dev proxy for multi-tenant dynamic routing; uses VITE_API_URL when set. */
  apiUrl: (raw.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "",
  appDomain: raw.VITE_APP_DOMAIN as string | undefined,
} as const;
