import {
  WorkspaceTableView,
  type WorkspaceTableViewProps,
} from "./WorkspaceTableView";
import React from "react";
import { WorkspaceListCards } from "@/platform/components/workspace/WorkspaceListCards";

export interface PlatformWorkspaceDirectoryViewProps extends WorkspaceTableViewProps {
  viewMode: "table" | "cards";
}

export function PlatformWorkspaceDirectoryView({
  viewMode,
  workspaces,
  descriptor,
  columnLayout,
  appDomain,
  density,
  sortField,
  sortDirection,
  onToggleSort,
  togglePending,
  deletePending,
  targetWorkspaceSubdomain,
  onToggleEnabled,
  onToggleEmailVerification,
  onOpenModules,
  onOpenDelete,
  onOpenResetPassword,
  onOpenCreateAdmin,
  onInspect,
  selectedSubdomains,
  onToggleSelect,
  onToggleSelectAll,
}: PlatformWorkspaceDirectoryViewProps): React.JSX.Element {
  if (viewMode === "table") {
    return (
      <WorkspaceTableView
        workspaces={workspaces}
        descriptor={descriptor}
        columnLayout={columnLayout}
        appDomain={appDomain}
        density={density}
        sortField={sortField}
        sortDirection={sortDirection}
        onToggleSort={onToggleSort}
        togglePending={togglePending}
        deletePending={deletePending}
        targetWorkspaceSubdomain={targetWorkspaceSubdomain}
        onToggleEnabled={onToggleEnabled}
        onToggleEmailVerification={onToggleEmailVerification}
        onOpenModules={onOpenModules}
        onOpenDelete={onOpenDelete}
        onOpenResetPassword={onOpenResetPassword}
        onOpenCreateAdmin={onOpenCreateAdmin}
        onInspect={onInspect}
        selectedSubdomains={selectedSubdomains}
        onToggleSelect={onToggleSelect}
        onToggleSelectAll={onToggleSelectAll}
      />
    );
  }

  return (
    <WorkspaceListCards
      workspaces={workspaces}
      descriptor={descriptor}
      appDomain={appDomain}
      togglePending={togglePending}
      deletePending={deletePending}
      targetWorkspaceSubdomain={targetWorkspaceSubdomain}
      onToggleEnabled={onToggleEnabled}
      onToggleEmailVerification={onToggleEmailVerification}
      onOpenModules={onOpenModules}
      onOpenDelete={onOpenDelete}
      onOpenResetPassword={onOpenResetPassword}
      onOpenCreateAdmin={onOpenCreateAdmin}
      onInspect={onInspect}
      selectedSubdomains={selectedSubdomains}
      onToggleSelect={onToggleSelect}
    />
  );
}
