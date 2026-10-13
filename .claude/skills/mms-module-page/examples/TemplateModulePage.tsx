import { ModulePageShell, type ModulePageShellProps } from '@/components/app/ModulePageShell';

/** Shell-only example, not a fabricated domain module.
 * Derive tabs from the real manifest and current permissions. Intersect the
 * persisted active tab with allowed tabs BEFORE constructing children/queries.
 * See ContactsPage.tsx for real tier imports and module wiring.
 */
export function TemplateModulePage(props: ModulePageShellProps) {
  return <ModulePageShell {...props} />;
}
