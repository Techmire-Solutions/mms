import { isSettingsSection, ROUTES, type SettingsSection } from "@/lib/config/routes";

/**
 * Canonical settings deep-link contract: `?tab=<section>` is shareable and wins
 * over in-app navigation state, which stays supported for existing callers
 * (`ModuleAccessDeniedState`). Values are validated against the section registry
 * so an unknown `tab` falls back to the persisted/default tab instead of a blank
 * page.
 */
export function resolveSettingsSection(
  search: string,
  state: unknown,
): SettingsSection | undefined {
  const querySection = new URLSearchParams(search).get("tab");
  if (querySection && isSettingsSection(querySection)) return querySection;

  const stateSection = (state as { settingsTab?: unknown } | null | undefined)?.settingsTab;
  if (typeof stateSection === "string" && isSettingsSection(stateSection)) return stateSection;

  return undefined;
}

/** Canonical URL for a settings section (used by links, redirects and tests). */
export function settingsTabPath(section: SettingsSection): string {
  return `${ROUTES.settings}?tab=${section}`;
}
