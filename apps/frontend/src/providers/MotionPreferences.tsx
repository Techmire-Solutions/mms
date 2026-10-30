import React from "react";
import { MotionConfig } from "framer-motion";

/**
 * Global framer-motion policy: animations follow the OS `prefers-reduced-motion`
 * setting.
 *
 * It intentionally does **not** live in `AppProviders`: that module is part of the
 * entry closure, so mounting `MotionConfig` there pulled the whole framer-motion
 * runtime (~46 KB gzip, 271 modules) into the first paint and the PWA precache of
 * every visitor — including unauthenticated login/admissions pages that never
 * animate. Every `motion.*` renderer lives below the authenticated tenant shell
 * (`AppLayout`) or the apex tree, so the config is mounted there instead.
 *
 * Do not import this from an entry-path module; `check:pwa` fails if the
 * `vendor-motion` chunk reappears in the precache.
 */
export function MotionPreferences({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
