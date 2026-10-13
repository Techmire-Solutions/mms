/**
 * Canonical persisted ids for the standard module page shell.
 * Product UI labels the primary ops tab with the module name (`nav.*`);
 * `DEFAULT_MODULE_TIER_TAB_LABELS.work` is a seed/fallback string only.
 */
export const MODULE_TIER_TAB_IDS = ["work", "reports", "setup"] as const;

export type ModuleTierTabId = (typeof MODULE_TIER_TAB_IDS)[number];

/** Pre–Work/Reports/Setup tab ids — migrate on read from storage and contact config. */
export const LEGACY_MODULE_TIER_TAB_IDS = {
  operations: "work",
  analytics: "reports",
  configuration: "setup",
} as const;

export type LegacyModuleTierTabId = keyof typeof LEGACY_MODULE_TIER_TAB_IDS;

/** English seed/fallback labels — product tabs use `nav.*` for the primary ops tab. */
export const DEFAULT_MODULE_TIER_TAB_LABELS: Record<ModuleTierTabId, string> = {
  work: "Work",
  reports: "Reports",
  setup: "Setup",
};

const LEGACY_MODULE_TIER_LABELS = new Set(["Operations", "Analytics", "Configuration"]);

export interface ModuleTierTabLike {
  key: string;
  label: string;
  isSystem?: boolean;
}

/** Active tab id when every tier section is collapsed. */
export const MODULE_TIER_TAB_CLOSED = "" as const;

/** Maps legacy tier tab ids to canonical ids. */
export function normalizeModuleTierTabId(id: string): string {
  if (id === MODULE_TIER_TAB_CLOSED) return MODULE_TIER_TAB_CLOSED;
  return LEGACY_MODULE_TIER_TAB_IDS[id as LegacyModuleTierTabId] ?? id;
}

/** Keeps persisted/requested tab when visible; otherwise collapsed. */
export function resolveModuleTierTab(activeTab: string, visibleTabIds: readonly string[]): string {
  if (activeTab === MODULE_TIER_TAB_CLOSED) return MODULE_TIER_TAB_CLOSED;
  return visibleTabIds.includes(activeTab) ? activeTab : MODULE_TIER_TAB_CLOSED;
}

const MODULE_TIER_TAB_ID_SET = new Set<string>(MODULE_TIER_TAB_IDS);

export function isModuleTierTabId(key: string): key is ModuleTierTabId {
  return MODULE_TIER_TAB_ID_SET.has(key);
}

/** Upgrades persisted system tier tab keys from legacy ids. */
export function refreshModuleTierTabKeys<T extends ModuleTierTabLike>(tabs: T[]): T[] {
  return tabs.map((tab) => {
    const nextKey = LEGACY_MODULE_TIER_TAB_IDS[tab.key as LegacyModuleTierTabId];
    return nextKey ? { ...tab, key: nextKey } : tab;
  });
}

/** Upgrades legacy tab keys and English labels in stored contact page-tab config. */
export function refreshModuleTierTabLabels<T extends ModuleTierTabLike>(tabs: T[]): T[] {
  return refreshModuleTierTabKeys(tabs).map((tab) => {
    const id = tab.key as ModuleTierTabId;
    if (!isModuleTierTabId(id)) return tab;
    if (LEGACY_MODULE_TIER_LABELS.has(tab.label)) {
      return { ...tab, label: DEFAULT_MODULE_TIER_TAB_LABELS[id] };
    }
    return tab;
  });
}
