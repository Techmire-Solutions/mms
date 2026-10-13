import React from "react";
import {
  ModuleScaffold,
  ModuleScaffoldSkeleton,
  type ModuleScaffoldProps,
  type ModuleScaffoldSkeletonProps,
} from "@/components/common/ModuleScaffold";

export type ModulePageShellProps = ModuleScaffoldProps;

/**
 * ModulePageShell — DRY top-level layout wrapper for module pages.
 * Delegates to Universal ModuleScaffold with ErrorBoundary and SEO metadata.
 */
export function ModulePageShell(props: ModulePageShellProps): React.JSX.Element {
  return <ModuleScaffold {...props} />;
}

export { ModuleScaffoldSkeleton };
export type { ModuleScaffoldProps, ModuleScaffoldSkeletonProps };
