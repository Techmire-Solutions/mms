import type { PermissionAction, PermissionMap } from "./userEntityTypes.js";
import { PERMISSION_ACTIONS } from "./userEntityTypes.js";
import { RBAC_MODULE_IDS, type RbacModuleId } from "./userRbacModuleRegistry.js";

export const ALL_RBAC_MODULE_IDS: readonly RbacModuleId[] = RBAC_MODULE_IDS;

/**
 * Creates a permission map granting all actions across the given (or all) modules.
 */
export function createFullPermissionMap(
  moduleIds: readonly (string | RbacModuleId)[] = ALL_RBAC_MODULE_IDS,
): PermissionMap {
  const p: PermissionMap = {};
  for (const m of moduleIds) {
    p[m] = [...PERMISSION_ACTIONS];
  }
  return p;
}

/**
 * Creates a permission map granting read-only access across the given (or all) modules.
 */
export function createReadOnlyPermissionMap(
  moduleIds: readonly (string | RbacModuleId)[] = ALL_RBAC_MODULE_IDS,
): PermissionMap {
  const p: PermissionMap = {};
  for (const m of moduleIds) {
    p[m] = ["read"];
  }
  return p;
}

/**
 * Creates an empty permission map for the given (or all) modules.
 */
export function createEmptyPermissionMap(
  moduleIds: readonly (string | RbacModuleId)[] = ALL_RBAC_MODULE_IDS,
): PermissionMap {
  const p: PermissionMap = {};
  for (const m of moduleIds) {
    p[m] = [];
  }
  return p;
}

export type ReadonlyPermissionMap = Readonly<Record<string, readonly PermissionAction[]>>;

/** Deep clones a permission map ensuring array isolation. */
export function clonePermissionMap(
  map?: PermissionMap | ReadonlyPermissionMap | null,
): PermissionMap {
  if (!map) return {};
  const cloned: PermissionMap = {};
  for (const [module, actions] of Object.entries(map)) {
    cloned[module] = Array.isArray(actions) ? [...actions] : [];
  }
  return cloned;
}

/** Merges an override permission map over a base permission map. */
export function mergePermissionMaps(
  base: PermissionMap | ReadonlyPermissionMap,
  overrides?: PermissionMap | ReadonlyPermissionMap | null,
): PermissionMap {
  const result = clonePermissionMap(base);
  if (!overrides) return result;
  for (const [module, actions] of Object.entries(overrides)) {
    result[module] = Array.isArray(actions) ? [...actions] : [];
  }
  return result;
}

/**
 * Additive union of permission maps: per module, union of actions
 * in {@link PERMISSION_ACTIONS} order.
 */
export function unionPermissionMaps(
  maps: readonly (PermissionMap | ReadonlyPermissionMap | null | undefined)[],
): PermissionMap {
  const result: PermissionMap = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [module, actions] of Object.entries(map)) {
      if (!Array.isArray(actions) || actions.length === 0) continue;
      const set = new Set<PermissionAction>([
        ...(result[module] ?? []),
        ...actions.filter((a): a is PermissionAction =>
          (PERMISSION_ACTIONS as readonly string[]).includes(a),
        ),
      ]);
      result[module] = PERMISSION_ACTIONS.filter((a) => set.has(a));
    }
  }
  return result;
}

/** Returns the total count of granted actions across all modules in a permission map. */
export function countGrantedActions(map?: PermissionMap | ReadonlyPermissionMap | null): number {
  if (!map) return 0;
  return Object.values(map).reduce(
    (total, actions) => total + (Array.isArray(actions) ? actions.length : 0),
    0,
  );
}

/** Returns true if the map grants all 4 permissions across all specified modules. */
export function isFullPermissionMap(
  map?: PermissionMap | ReadonlyPermissionMap | null,
  moduleIds: readonly (string | RbacModuleId)[] = ALL_RBAC_MODULE_IDS,
): boolean {
  if (!map) return false;
  return moduleIds.every((mod) => {
    const actions = map[mod];
    return (
      Array.isArray(actions) &&
      actions.length >= 4 &&
      PERMISSION_ACTIONS.every((act) => actions.includes(act))
    );
  });
}

/** Returns true if the map has zero granted actions across all modules. */
export function isEmptyPermissionMap(map?: PermissionMap | ReadonlyPermissionMap | null): boolean {
  return countGrantedActions(map) === 0;
}

/** Computes added and removed permission actions between two permission maps. */
export function diffPermissionMaps(
  before: PermissionMap | ReadonlyPermissionMap,
  after: PermissionMap | ReadonlyPermissionMap,
): { added: PermissionMap; removed: PermissionMap } {
  const added: PermissionMap = {};
  const removed: PermissionMap = {};
  const allModules = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const mod of allModules) {
    const beforeActions = before[mod] ?? [];
    const afterActions = after[mod] ?? [];

    const beforeSet = new Set(beforeActions);
    const afterSet = new Set(afterActions);

    const newlyAdded = afterActions.filter((a) => !beforeSet.has(a));
    const newlyRemoved = beforeActions.filter((a) => !afterSet.has(a));

    if (newlyAdded.length > 0) added[mod] = newlyAdded;
    if (newlyRemoved.length > 0) removed[mod] = newlyRemoved;
  }

  return { added, removed };
}

/** Type guard verifying if a value matches the PermissionMap structure. */
export function isPermissionMap(value: unknown): value is PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const validActions = new Set<string>(PERMISSION_ACTIONS);
  return Object.values(value).every(
    (actions) =>
      Array.isArray(actions) && actions.every((a) => typeof a === "string" && validActions.has(a)),
  );
}
