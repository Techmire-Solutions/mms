import React from "react";
import {
  WorkspaceTableView,
  type WorkspaceTableViewProps,
} from "@/platform/components/workspace/WorkspaceTableView";

export type PlatformWorkspaceVirtualTableProps = WorkspaceTableViewProps;

/**
 * 2026 Density-Aware Virtualized Workspace Grid.
 * Encapsulates WorkBatchTable with dynamic @tanstack/react-virtual row height estimation,
 * multi-density layouts (compact, standard, comfortable), and WCAG 2.2 accessibility.
 */
export function PlatformWorkspaceVirtualTable(
  props: PlatformWorkspaceVirtualTableProps,
): React.JSX.Element {
  return <WorkspaceTableView {...props} />;
}
