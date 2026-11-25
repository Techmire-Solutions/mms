/**
 * Clamps the persisted/deep-linked module tab to the tabs the role can see.
 *
 * `visibleTabs` hides Setup for roles without `configuration.view`, but a
 * `?tab=setup` deep link (or a persisted tab left over from before a role
 * change) used to render the hidden tier anyway. Rendering falls back to Work.
 */
export function resolveActiveTab<T extends { id: string }>(
  activeTab: string,
  visibleTabs: readonly T[],
): string {
  if (visibleTabs.length === 0) return activeTab;
  return visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : (visibleTabs[0]?.id ?? "work");
}
