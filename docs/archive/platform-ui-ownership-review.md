# Platform UI ownership review — 30 September 2026

Inventory: **146 non-test TSX files** under `apps/frontend/src/platform`, including components, pages, context providers, and routes. Every file is included below.

## Ownership model

- Reusable controls, cards, feedback, progress, and bulk-action rendering live in `components/ui` or the existing generic `components/common/work` layer.
- Platform compositions live in `platform/components`; route entry points live in `platform/pages`.
- Platform state and side effects live in hooks; navigation, permission metadata, and metric calculations have named owners in `platform/lib`.
- Compatibility entry points re-export existing implementations. They are not parallel implementations; no files were deleted.

## Consolidation performed

| Concern | Single owner / consumers |
| --- | --- |
| Sidebar sections | `platformNav.getVisiblePlatformNavSections`; desktop and mobile sidebar |
| Search and sign-out chrome | `PlatformSidebarSearch`, `PlatformSignOutDialog`; desktop and mobile sidebar |
| Create-workspace action | `PlatformOnboardingAction`; dashboard, workspaces page, console |
| Bulk status actions | `StatusBulkActionDock`; admin and workspace adapters |
| Permission metadata | `PLATFORM_PERMISSION_CONFIG`; fields, badges, matrix, reports |
| Selection cards | `FormCheckboxCard`; module selector and permission card adapters |
| Operator metrics | `getPlatformAdminMetrics`; Work metrics and Reports |
| Report metrics / bars | `ModuleCommandMetricsGrid`, `ProgressBar` |
| Permission matrix | `WorkBatchTable` plus `usePlatformPermissionMatrix`; virtualized large lists, error/retry state, mutation guard |
| Workspace view contract | `WorkspaceTableViewProps`; card and directory variants derive their contracts |
| Surfaces / feedback / theme | Shared owners introduced in the preceding review, preserved here |

## Automated ownership checks

`platformUiArchitecture.test.ts` scans the entire platform TSX tree and checks:

- No direct native button, input, select, textarea, table, or dialog rendering.
- No duplicate exported component implementation names. Re-exports remain allowed.
- No raw Tailwind palette classes from the checked palette families.
- No identical 16-line normalized JSX blocks copied across platform files.

These checks catch mechanical duplication, not every semantic equivalence. Different components may legitimately compose the same primitives. A file is not moved merely because it renders JSX. Browser testing covers representative flows rather than every possible component state.

## Component inventory

Paths below are relative to `apps/frontend/src/platform`. Shared imports show each file’s direct reusable UI dependencies; composition files may reach shared primitives through their children.

| File | Ownership | Direct shared UI dependencies |
| --- | --- | --- |
| [ components/ApexBootPrefetch.tsx ](../apps/frontend/src/platform/components/ApexBootPrefetch.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/ApexPageNotFound.tsx ](../apps/frontend/src/platform/components/ApexPageNotFound.tsx) | Platform composition / entry point | `entry/AuthPageShell`, `entry/AuthStatusBanner`, `entry/EntryPageHead`, `ui/button` |
| [ components/PlatformActivityLogsContent.tsx ](../apps/frontend/src/platform/components/PlatformActivityLogsContent.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/EmptyState`, `ui/ErrorState`, `ui/LoadingState`, `ui/ModuleWorkToolbar`, `ui/SubTabBar`, `ui/WidgetCard`, `ui/WidgetCardHeader` |
| [ components/PlatformAdminDangerDialog.tsx ](../apps/frontend/src/platform/components/PlatformAdminDangerDialog.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/PlatformAdminPermissionsFields.tsx ](../apps/frontend/src/platform/components/PlatformAdminPermissionsFields.tsx) | Platform composition / entry point | `ui/ActionButton` |
| [ components/PlatformAdminsContent.tsx ](../apps/frontend/src/platform/components/PlatformAdminsContent.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/ModuleCommandMetricsGrid` |
| [ components/PlatformAuthLayout.tsx ](../apps/frontend/src/platform/components/PlatformAuthLayout.tsx) | Platform composition / entry point | `entry`, `ui/badge` |
| [ components/PlatformBootGate.tsx ](../apps/frontend/src/platform/components/PlatformBootGate.tsx) | Platform composition / entry point | `routing/RouteStatusFallback` |
| [ components/PlatformCommandPalette.tsx ](../apps/frontend/src/platform/components/PlatformCommandPalette.tsx) | Platform composition / entry point | `ui/CommandPaletteModal`, `ui/useCommandPaletteSearch` |
| [ components/PlatformDashboard.tsx ](../apps/frontend/src/platform/components/PlatformDashboard.tsx) | Platform composition / entry point | `ui/EmptyState`, `ui/ErrorState`, `ui/LoadingState`, `ui/ModuleCommandMetricsGrid`, `ui/button` |
| [ components/PlatformEditAdminAccessDialog.tsx ](../apps/frontend/src/platform/components/PlatformEditAdminAccessDialog.tsx) | Platform composition / entry point | `ui/FormModal` |
| [ components/PlatformFirstRunGate.tsx ](../apps/frontend/src/platform/components/PlatformFirstRunGate.tsx) | Platform composition / entry point | `routing/RouteStatusFallback`, `ui/ErrorState` |
| [ components/PlatformPageShell.tsx ](../apps/frontend/src/platform/components/PlatformPageShell.tsx) | Platform composition / entry point | `common`, `common/AppShell`, `ui/AppFooter`, `ui/tooltip` |
| [ components/PlatformPageShellHeader.tsx ](../apps/frontend/src/platform/components/PlatformPageShellHeader.tsx) | Platform composition / entry point | `ui/badge`, `ui/button` |
| [ components/PlatformReports.tsx ](../apps/frontend/src/platform/components/PlatformReports.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/ExportToolbar` |
| [ components/PlatformSessionTimeoutWatcher.tsx ](../apps/frontend/src/platform/components/PlatformSessionTimeoutWatcher.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/PlatformSidebar.tsx ](../apps/frontend/src/platform/components/PlatformSidebar.tsx) | Platform composition / entry point | `ui/tooltip` |
| [ components/PlatformSidebarNav.tsx ](../apps/frontend/src/platform/components/PlatformSidebarNav.tsx) | Platform composition / entry point | `ui/SidebarNavItem`, `ui/tooltip` |
| [ components/PlatformSystemMaintenance.tsx ](../apps/frontend/src/platform/components/PlatformSystemMaintenance.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/StatCard` |
| [ components/PlatformTypedConfirmDialog.tsx ](../apps/frontend/src/platform/components/PlatformTypedConfirmDialog.tsx) | Platform composition / entry point | `ui/TypedConfirmDialog` |
| [ components/PlatformWorkspaceCreateAdminDialog.tsx ](../apps/frontend/src/platform/components/PlatformWorkspaceCreateAdminDialog.tsx) | Platform composition / entry point | `ui/FormField`, `ui/LeadingIconInput`, `ui/Modal` |
| [ components/PlatformWorkspaceDeleteDialog.tsx ](../apps/frontend/src/platform/components/PlatformWorkspaceDeleteDialog.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/PlatformWorkspaceList.tsx ](../apps/frontend/src/platform/components/PlatformWorkspaceList.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/EmptyState`, `ui/ListPagination`, `ui/ModuleWorkListStateShell` |
| [ components/PlatformWorkspaceModulesDialog.tsx ](../apps/frontend/src/platform/components/PlatformWorkspaceModulesDialog.tsx) | Platform composition / entry point | `ui/FormModal`, `ui/LoadingState` |
| [ components/PlatformWorkspaceResetPasswordDialog.tsx ](../apps/frontend/src/platform/components/PlatformWorkspaceResetPasswordDialog.tsx) | Platform composition / entry point | `ui/CredentialsResultCard`, `ui/Modal` |
| [ components/PlatformWorkspaceSortMenu.tsx ](../apps/frontend/src/platform/components/PlatformWorkspaceSortMenu.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/dropdown-menu` |
| [ components/WorkspaceLogo.tsx ](../apps/frontend/src/platform/components/WorkspaceLogo.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/WorkspaceRegistryList.tsx ](../apps/frontend/src/platform/components/WorkspaceRegistryList.tsx) | Platform composition / entry point | `ui/EmptyState`, `ui/ErrorState`, `ui/LoadingState`, `ui/SectionLabel` |
| [ components/activity-logs/ActivityLogInspectModal.tsx ](../apps/frontend/src/platform/components/activity-logs/ActivityLogInspectModal.tsx) | Platform composition / entry point | `ui/CopyBtn`, `ui/Modal`, `ui/SubTabBar` |
| [ components/activity-logs/ActivityLogRow.tsx ](../apps/frontend/src/platform/components/activity-logs/ActivityLogRow.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/badge` |
| [ components/activity-logs/PlatformActivityLogsTimeline.tsx ](../apps/frontend/src/platform/components/activity-logs/PlatformActivityLogsTimeline.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/admin/PlatformAdminActionButtons.tsx ](../apps/frontend/src/platform/components/admin/PlatformAdminActionButtons.tsx) | Platform composition / entry point | `ui/ActionButton` |
| [ components/admin/PlatformAdminBadges.tsx ](../apps/frontend/src/platform/components/admin/PlatformAdminBadges.tsx) | Platform composition / entry point | `ui/StatusBadge` |
| [ components/admin/PlatformAdminBulkDock.tsx ](../apps/frontend/src/platform/components/admin/PlatformAdminBulkDock.tsx) | Platform composition / entry point | `ui/StatusBulkActionDock` |
| [ components/admin/PlatformAdminListCards.tsx ](../apps/frontend/src/platform/components/admin/PlatformAdminListCards.tsx) | Compatibility re-export | Via platform children or non-visual module |
| [ components/admin/PlatformAdminsDialogs.tsx ](../apps/frontend/src/platform/components/admin/PlatformAdminsDialogs.tsx) | Platform composition / entry point | `common/DetailSheet` |
| [ components/admin/PlatformAdminsListCards.tsx ](../apps/frontend/src/platform/components/admin/PlatformAdminsListCards.tsx) | Platform composition / entry point | `ui/DirectoryCard`, `ui/DirectoryCardMetadata`, `ui/DirectoryCardsGrid`, `ui/checkbox` |
| [ components/admin/PlatformAdminsTableView.tsx ](../apps/frontend/src/platform/components/admin/PlatformAdminsTableView.tsx) | Platform composition / entry point | `common/work/WorkBatchTable`, `common/work/workBatchTableTypes` |
| [ components/admin/PlatformAdminsToolbar.tsx ](../apps/frontend/src/platform/components/admin/PlatformAdminsToolbar.tsx) | Platform composition / entry point | `common/work`, `ui/ActionButton`, `ui/SubTabBar` |
| [ components/admin/PlatformPermissionCheckboxItem.tsx ](../apps/frontend/src/platform/components/admin/PlatformPermissionCheckboxItem.tsx) | Platform composition / entry point | `ui/FormCheckboxCard`, `ui/badge` |
| [ components/command/PlatformCommandResultsList.tsx ](../apps/frontend/src/platform/components/command/PlatformCommandResultsList.tsx) | Platform composition / entry point | `ui/button` |
| [ components/common/PlatformLiveRegion.tsx ](../apps/frontend/src/platform/components/common/PlatformLiveRegion.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/common/PlatformLogoMark.tsx ](../apps/frontend/src/platform/components/common/PlatformLogoMark.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/common/PlatformOnboardingAction.tsx ](../apps/frontend/src/platform/components/common/PlatformOnboardingAction.tsx) | Platform composition / entry point | `ui/button` |
| [ components/common/PlatformSignOutDialog.tsx ](../apps/frontend/src/platform/components/common/PlatformSignOutDialog.tsx) | Platform composition / entry point | `ui/ConfirmAlertDialog` |
| [ components/dashboard/PlatformDashboardBanner.tsx ](../apps/frontend/src/platform/components/dashboard/PlatformDashboardBanner.tsx) | Platform composition / entry point | `ui/badge`, `ui/button`, `ui/formStyles` |
| [ components/dashboard/PlatformDashboardCharts.tsx ](../apps/frontend/src/platform/components/dashboard/PlatformDashboardCharts.tsx) | Platform composition / entry point | `dashboard-widgets/charts/chartPrimitives`, `ui/WidgetCard`, `ui/WidgetCardHeader`, `ui/reports/ReportChartCard` |
| [ components/dashboard/PlatformDashboardQuickActions.tsx ](../apps/frontend/src/platform/components/dashboard/PlatformDashboardQuickActions.tsx) | Platform composition / entry point | `ui/WidgetCard`, `ui/WidgetCardHeader`, `ui/button` |
| [ components/dashboard/PlatformDashboardTelemetry.tsx ](../apps/frontend/src/platform/components/dashboard/PlatformDashboardTelemetry.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/ModuleCommandMetricsGrid` |
| [ components/erd/ErdCanvasToolbar.tsx ](../apps/frontend/src/platform/components/erd/ErdCanvasToolbar.tsx) | Platform composition / entry point | `ui/ActionButton` |
| [ components/erd/ErdExplorer.tsx ](../apps/frontend/src/platform/components/erd/ErdExplorer.tsx) | Platform composition / entry point | `ui/FormField`, `ui/FormSelect`, `ui/formStyles` |
| [ components/erd/ErdMermaidDiagram.tsx ](../apps/frontend/src/platform/components/erd/ErdMermaidDiagram.tsx) | Platform composition / entry point | `ui/ErrorState`, `ui/formStyles` |
| [ components/erd/ErdRelationshipList.tsx ](../apps/frontend/src/platform/components/erd/ErdRelationshipList.tsx) | Platform composition / entry point | `ui/formStyles` |
| [ components/header/PlatformHeaderBrand.tsx ](../apps/frontend/src/platform/components/header/PlatformHeaderBrand.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/header/PlatformHeaderUserNav.tsx ](../apps/frontend/src/platform/components/header/PlatformHeaderUserNav.tsx) | Platform composition / entry point | `ui/BackgroundJobsTray`, `ui/UserNavDropdown`, `ui/button`, `ui/dropdown-menu` |
| [ components/header/PlatformLanguagePicker.tsx ](../apps/frontend/src/platform/components/header/PlatformLanguagePicker.tsx) | Platform composition / entry point | `ui/LanguagePicker` |
| [ components/header/PlatformNotificationsPopover.tsx ](../apps/frontend/src/platform/components/header/PlatformNotificationsPopover.tsx) | Platform composition / entry point | `ui/NotificationsPopover` |
| [ components/intelligence/PlatformAiDrawer.tsx ](../apps/frontend/src/platform/components/intelligence/PlatformAiDrawer.tsx) | Platform composition / entry point | `ui/button` |
| [ components/intelligence/PlatformAiMessageList.tsx ](../apps/frontend/src/platform/components/intelligence/PlatformAiMessageList.tsx) | Platform composition / entry point | `ui/badge`, `ui/button` |
| [ components/intelligence/PlatformAiPromptBar.tsx ](../apps/frontend/src/platform/components/intelligence/PlatformAiPromptBar.tsx) | Platform composition / entry point | `ui/button`, `ui/input` |
| [ components/onboarding/WizardLayout.tsx ](../apps/frontend/src/platform/components/onboarding/WizardLayout.tsx) | Platform composition / entry point | `entry/AuthPageShell`, `ui/WizardStepIndicator`, `ui/button` |
| [ components/reports/PlatformReportsGrowthChart.tsx ](../apps/frontend/src/platform/components/reports/PlatformReportsGrowthChart.tsx) | Platform composition / entry point | `dashboard-widgets/charts/chartPrimitives`, `ui/SubTabBar`, `ui/reports/ReportChartCard` |
| [ components/reports/PlatformReportsMetrics.tsx ](../apps/frontend/src/platform/components/reports/PlatformReportsMetrics.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/ModuleCommandMetricsGrid` |
| [ components/reports/PlatformReportsModuleAdoption.tsx ](../apps/frontend/src/platform/components/reports/PlatformReportsModuleAdoption.tsx) | Platform composition / entry point | `ui/badge`, `ui/reports/ReportChartCard` |
| [ components/reports/PlatformReportsOperatorCard.tsx ](../apps/frontend/src/platform/components/reports/PlatformReportsOperatorCard.tsx) | Platform composition / entry point | `ui/WidgetCard`, `ui/WidgetCardHeader`, `ui/badge`, `ui/formStyles` |
| [ components/reports/PlatformReportsPieCharts.tsx ](../apps/frontend/src/platform/components/reports/PlatformReportsPieCharts.tsx) | Platform composition / entry point | `ui/reports/ReportChartCard` |
| [ components/reports/platformChartTooltips.tsx ](../apps/frontend/src/platform/components/reports/platformChartTooltips.tsx) | Platform composition / entry point | `dashboard-widgets/charts/chartPrimitives` |
| [ components/settings/PlatformGlobalSettingsPanel.tsx ](../apps/frontend/src/platform/components/settings/PlatformGlobalSettingsPanel.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/button`, `ui/card`, `ui/input`, `ui/switch` |
| [ components/settings/PlatformSecuritySettingsPanel.tsx ](../apps/frontend/src/platform/components/settings/PlatformSecuritySettingsPanel.tsx) | Platform composition / entry point | `ui/badge`, `ui/button`, `ui/card` |
| [ components/settings/PlatformSystemSettingsPanel.tsx ](../apps/frontend/src/platform/components/settings/PlatformSystemSettingsPanel.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/settings/PlatformThemeSettingsPanel.tsx ](../apps/frontend/src/platform/components/settings/PlatformThemeSettingsPanel.tsx) | Platform composition / entry point | `ui/button`, `ui/card` |
| [ components/sidebar/PlatformMobileSidebar.tsx ](../apps/frontend/src/platform/components/sidebar/PlatformMobileSidebar.tsx) | Platform composition / entry point | `ui/formStyles`, `ui/tooltip` |
| [ components/sidebar/PlatformSidebarBrand.tsx ](../apps/frontend/src/platform/components/sidebar/PlatformSidebarBrand.tsx) | Platform composition / entry point | `ui/ActionButton` |
| [ components/sidebar/PlatformSidebarFooter.tsx ](../apps/frontend/src/platform/components/sidebar/PlatformSidebarFooter.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/SectionLabel`, `ui/UserAvatar` |
| [ components/sidebar/PlatformSidebarSearch.tsx ](../apps/frontend/src/platform/components/sidebar/PlatformSidebarSearch.tsx) | Platform composition / entry point | `ui/button` |
| [ components/system/PlatformDatabaseTelemetryCard.tsx ](../apps/frontend/src/platform/components/system/PlatformDatabaseTelemetryCard.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/system/PlatformLatencySparkline.tsx ](../apps/frontend/src/platform/components/system/PlatformLatencySparkline.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/tiers/PlatformReportsTier.tsx ](../apps/frontend/src/platform/components/tiers/PlatformReportsTier.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/SubTabBar` |
| [ components/tiers/PlatformSetupTier.tsx ](../apps/frontend/src/platform/components/tiers/PlatformSetupTier.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/SubTabBar` |
| [ components/tiers/PlatformWorkTier.tsx ](../apps/frontend/src/platform/components/tiers/PlatformWorkTier.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/SubTabBar` |
| [ components/users/PlatformPermissionMatrix.tsx ](../apps/frontend/src/platform/components/users/PlatformPermissionMatrix.tsx) | Platform composition / entry point | `common/work/WorkBatchTable`, `ui/EmptyState`, `ui/ErrorState`, `ui/LoadingState`, `ui/SearchBar`, `ui/badge`, `ui/button` |
| [ components/users/PlatformUsersCommandMetrics.tsx ](../apps/frontend/src/platform/components/users/PlatformUsersCommandMetrics.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/ModuleCommandMetricsGrid` |
| [ components/users/PlatformUsersReportsTier.tsx ](../apps/frontend/src/platform/components/users/PlatformUsersReportsTier.tsx) | Platform composition / entry point | `ui/ErrorState`, `ui/LoadingState`, `ui/ModuleCommandMetricsGrid`, `ui/ProgressBar`, `ui/card` |
| [ components/users/PlatformUsersSetupTier.tsx ](../apps/frontend/src/platform/components/users/PlatformUsersSetupTier.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/SubTabBar` |
| [ components/users/PlatformUsersWorkTier.tsx ](../apps/frontend/src/platform/components/users/PlatformUsersWorkTier.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/workspace/CreateAdminResultCard.tsx ](../apps/frontend/src/platform/components/workspace/CreateAdminResultCard.tsx) | Platform composition / entry point | `ui/CredentialsResultCard` |
| [ components/workspace/PlatformModulePresetsBar.tsx ](../apps/frontend/src/platform/components/workspace/PlatformModulePresetsBar.tsx) | Platform composition / entry point | `ui/ActionButton` |
| [ components/workspace/PlatformModuleSelectCard.tsx ](../apps/frontend/src/platform/components/workspace/PlatformModuleSelectCard.tsx) | Platform composition / entry point | `ui/FormCheckboxCard`, `ui/badge` |
| [ components/workspace/PlatformWorkspaceBulkDock.tsx ](../apps/frontend/src/platform/components/workspace/PlatformWorkspaceBulkDock.tsx) | Platform composition / entry point | `ui/StatusBulkActionDock` |
| [ components/workspace/PlatformWorkspaceDensityToggle.tsx ](../apps/frontend/src/platform/components/workspace/PlatformWorkspaceDensityToggle.tsx) | Platform composition / entry point | `ui/button`, `ui/tooltip` |
| [ components/workspace/PlatformWorkspaceDialogs.tsx ](../apps/frontend/src/platform/components/workspace/PlatformWorkspaceDialogs.tsx) | Platform composition / entry point | `common/DetailSheet` |
| [ components/workspace/PlatformWorkspaceDirectoryView.tsx ](../apps/frontend/src/platform/components/workspace/PlatformWorkspaceDirectoryView.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/workspace/PlatformWorkspaceToolbar.tsx ](../apps/frontend/src/platform/components/workspace/PlatformWorkspaceToolbar.tsx) | Platform composition / entry point | `common/work`, `ui/ActionButton`, `ui/SubTabBar` |
| [ components/workspace/PlatformWorkspaceVirtualTable.tsx ](../apps/frontend/src/platform/components/workspace/PlatformWorkspaceVirtualTable.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ components/workspace/WorkspaceAdminDialogFooter.tsx ](../apps/frontend/src/platform/components/workspace/WorkspaceAdminDialogFooter.tsx) | Platform composition / entry point | `ui/ActionButton` |
| [ components/workspace/WorkspaceCardsView.tsx ](../apps/frontend/src/platform/components/workspace/WorkspaceCardsView.tsx) | Compatibility re-export | Via platform children or non-visual module |
| [ components/workspace/WorkspaceIdentityCell.tsx ](../apps/frontend/src/platform/components/workspace/WorkspaceIdentityCell.tsx) | Platform composition / entry point | `ui/CopyBtn` |
| [ components/workspace/WorkspaceListCards.tsx ](../apps/frontend/src/platform/components/workspace/WorkspaceListCards.tsx) | Platform composition / entry point | `ui/DirectoryCard`, `ui/DirectoryCardMetadata`, `ui/DirectoryCardsGrid`, `ui/checkbox` |
| [ components/workspace/WorkspacePasswordField.tsx ](../apps/frontend/src/platform/components/workspace/WorkspacePasswordField.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/FormField`, `ui/input` |
| [ components/workspace/WorkspaceRowActions.tsx ](../apps/frontend/src/platform/components/workspace/WorkspaceRowActions.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/button`, `ui/label`, `ui/switch` |
| [ components/workspace/WorkspaceStatusBadge.tsx ](../apps/frontend/src/platform/components/workspace/WorkspaceStatusBadge.tsx) | Platform composition / entry point | `ui/StatusBadge` |
| [ components/workspace/WorkspaceSummary.tsx ](../apps/frontend/src/platform/components/workspace/WorkspaceSummary.tsx) | Platform composition / entry point | `ui/ReviewList` |
| [ components/workspace/WorkspaceTableView.tsx ](../apps/frontend/src/platform/components/workspace/WorkspaceTableView.tsx) | Platform composition / entry point | `common/work/WorkBatchTable`, `common/work/workBatchTableTypes`, `ui/label`, `ui/switch` |
| [ hooks/usePlatformSessionTimeout.tsx ](../apps/frontend/src/platform/hooks/usePlatformSessionTimeout.tsx) | Platform composition / entry point | `session/SessionTimeoutModal` |
| [ lib/PlatformAuthContext.tsx ](../apps/frontend/src/platform/lib/PlatformAuthContext.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ lib/PlatformSidebarContext.tsx ](../apps/frontend/src/platform/lib/PlatformSidebarContext.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ pages/ApexHome.tsx ](../apps/frontend/src/platform/pages/ApexHome.tsx) | Platform composition / entry point | `routing/RouteStatusFallback` |
| [ pages/ApexWorkspaceGate.tsx ](../apps/frontend/src/platform/pages/ApexWorkspaceGate.tsx) | Platform composition / entry point | `entry`, `ui/button` |
| [ pages/PlatformAccount.tsx ](../apps/frontend/src/platform/pages/PlatformAccount.tsx) | Platform composition / entry point | `common/ModuleScaffold`, `ui/ErrorState`, `ui/LoadingState`, `ui/SubTabBar` |
| [ pages/PlatformActivityLogsPage.tsx ](../apps/frontend/src/platform/pages/PlatformActivityLogsPage.tsx) | Platform composition / entry point | `common/ModuleScaffold` |
| [ pages/PlatformAddAdminForm.tsx ](../apps/frontend/src/platform/pages/PlatformAddAdminForm.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/FormField`, `ui/FormModal`, `ui/LeadingIconInput`, `ui/PasswordInput`, `ui/PasswordStrengthMeter`, `ui/SectionCard` |
| [ pages/PlatformAdmins.tsx ](../apps/frontend/src/platform/pages/PlatformAdmins.tsx) | Platform composition / entry point | `common/ModuleScaffold` |
| [ pages/PlatformAdminsList.tsx ](../apps/frontend/src/platform/pages/PlatformAdminsList.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/EmptyState`, `ui/ModuleWorkListStateShell`, `ui/formStyles` |
| [ pages/PlatformConsole.tsx ](../apps/frontend/src/platform/pages/PlatformConsole.tsx) | Platform composition / entry point | `common/ModuleScaffold`, `ui/EmptyState` |
| [ pages/PlatformDashboardPage.tsx ](../apps/frontend/src/platform/pages/PlatformDashboardPage.tsx) | Platform composition / entry point | `common/ModuleScaffold` |
| [ pages/PlatformErdPage.tsx ](../apps/frontend/src/platform/pages/PlatformErdPage.tsx) | Platform composition / entry point | `common/ModuleScaffold` |
| [ pages/PlatformReportsPage.tsx ](../apps/frontend/src/platform/pages/PlatformReportsPage.tsx) | Platform composition / entry point | `common/ModuleScaffold` |
| [ pages/PlatformSettingsPage.tsx ](../apps/frontend/src/platform/pages/PlatformSettingsPage.tsx) | Platform composition / entry point | `ui/LoadingState`, `ui/ModulePageShell`, `ui/ResponsiveAccordionTabs` |
| [ pages/PlatformSystemPage.tsx ](../apps/frontend/src/platform/pages/PlatformSystemPage.tsx) | Platform composition / entry point | `common/ModuleScaffold` |
| [ pages/PlatformUsersPage.tsx ](../apps/frontend/src/platform/pages/PlatformUsersPage.tsx) | Platform composition / entry point | `common/ModuleScaffold`, `ui/ResponsiveAccordionTabs` |
| [ pages/PlatformWorkspacesPage.tsx ](../apps/frontend/src/platform/pages/PlatformWorkspacesPage.tsx) | Platform composition / entry point | `common/ModuleScaffold` |
| [ pages/TenantNotFoundPage.tsx ](../apps/frontend/src/platform/pages/TenantNotFoundPage.tsx) | Platform composition / entry point | `entry`, `entry/EntryPageHead` |
| [ pages/account/PlatformMigrateRestartCard.tsx ](../apps/frontend/src/platform/pages/account/PlatformMigrateRestartCard.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/SectionCard` |
| [ pages/account/PlatformProfileCard.tsx ](../apps/frontend/src/platform/pages/account/PlatformProfileCard.tsx) | Platform composition / entry point | `ui/SectionCard` |
| [ pages/account/PlatformProfileNameForm.tsx ](../apps/frontend/src/platform/pages/account/PlatformProfileNameForm.tsx) | Platform composition / entry point | `ui/FormField`, `ui/FormSubmitActions`, `ui/SectionCard`, `ui/input` |
| [ pages/account/PlatformProfilePasswordForm.tsx ](../apps/frontend/src/platform/pages/account/PlatformProfilePasswordForm.tsx) | Platform composition / entry point | `ui/FormField`, `ui/FormSubmitActions`, `ui/PasswordInput`, `ui/PasswordStrengthMeter`, `ui/SectionCard` |
| [ pages/auth/PlatformForgotPassword.tsx ](../apps/frontend/src/platform/pages/auth/PlatformForgotPassword.tsx) | Platform composition / entry point | `entry` |
| [ pages/auth/PlatformForgotPasswordRequestStep.tsx ](../apps/frontend/src/platform/pages/auth/PlatformForgotPasswordRequestStep.tsx) | Platform composition / entry point | `entry` |
| [ pages/auth/PlatformForgotPasswordResetStep.tsx ](../apps/frontend/src/platform/pages/auth/PlatformForgotPasswordResetStep.tsx) | Platform composition / entry point | `entry`, `ui/OtpInput`, `ui/PasswordStrengthMeter` |
| [ pages/auth/PlatformForgotPasswordSentStep.tsx ](../apps/frontend/src/platform/pages/auth/PlatformForgotPasswordSentStep.tsx) | Platform composition / entry point | `entry`, `ui/ActionButton` |
| [ pages/auth/PlatformLoginPage.tsx ](../apps/frontend/src/platform/pages/auth/PlatformLoginPage.tsx) | Platform composition / entry point | `entry/AuthPageShell`, `routing/RouteStatusFallback`, `ui/ErrorState` |
| [ pages/auth/PlatformSetup.tsx ](../apps/frontend/src/platform/pages/auth/PlatformSetup.tsx) | Platform composition / entry point | `entry` |
| [ pages/auth/PlatformSetupRegisterForm.tsx ](../apps/frontend/src/platform/pages/auth/PlatformSetupRegisterForm.tsx) | Platform composition / entry point | `entry`, `ui/PasswordStrengthMeter` |
| [ pages/auth/PlatformSignIn.tsx ](../apps/frontend/src/platform/pages/auth/PlatformSignIn.tsx) | Platform composition / entry point | `entry/EntryPageHead`, `entry/useSignInCredentialsForm`, `ui/OtpInput` |
| [ pages/auth/steps/PlatformAuthForm.tsx ](../apps/frontend/src/platform/pages/auth/steps/PlatformAuthForm.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ pages/auth/steps/PlatformCredentialsStep.tsx ](../apps/frontend/src/platform/pages/auth/steps/PlatformCredentialsStep.tsx) | Platform composition / entry point | `entry/AuthEmailField`, `entry/AuthFormControls`, `entry/AuthPasswordField`, `entry/AuthStatusBanner` |
| [ pages/auth/steps/PlatformTwoFactorStep.tsx ](../apps/frontend/src/platform/pages/auth/steps/PlatformTwoFactorStep.tsx) | Platform composition / entry point | `entry/AuthFormControls`, `entry/AuthStatusBanner`, `ui/FormField`, `ui/OtpInput` |
| [ pages/onboarding/OnboardingWizard.tsx ](../apps/frontend/src/platform/pages/onboarding/OnboardingWizard.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ pages/onboarding/OnboardingWizardFooter.tsx ](../apps/frontend/src/platform/pages/onboarding/OnboardingWizardFooter.tsx) | Platform composition / entry point | `ui/ActionButton`, `ui/Alert` |
| [ pages/onboarding/steps/AdminSetup.tsx ](../apps/frontend/src/platform/pages/onboarding/steps/AdminSetup.tsx) | Platform composition / entry point | `entry`, `ui/FormField`, `ui/checkbox`, `ui/input` |
| [ pages/onboarding/steps/AdminSetupPasswordFields.tsx ](../apps/frontend/src/platform/pages/onboarding/steps/AdminSetupPasswordFields.tsx) | Platform composition / entry point | `entry`, `ui/PasswordStrengthMeter` |
| [ pages/onboarding/steps/CreateMadrasa.tsx ](../apps/frontend/src/platform/pages/onboarding/steps/CreateMadrasa.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ pages/onboarding/steps/CreateMadrasaIdentitySection.tsx ](../apps/frontend/src/platform/pages/onboarding/steps/CreateMadrasaIdentitySection.tsx) | Platform composition / entry point | `branding/BrandingShared`, `ui/FormField`, `ui/SectionCard`, `ui/input`, `ui/label` |
| [ pages/onboarding/steps/CreateMadrasaModulesSection.tsx ](../apps/frontend/src/platform/pages/onboarding/steps/CreateMadrasaModulesSection.tsx) | Platform composition / entry point | `ui/SectionCard` |
| [ pages/onboarding/steps/CreateMadrasaThemeSection.tsx ](../apps/frontend/src/platform/pages/onboarding/steps/CreateMadrasaThemeSection.tsx) | Platform composition / entry point | Via platform children or non-visual module |
| [ routes/ApexRoutes.tsx ](../apps/frontend/src/platform/routes/ApexRoutes.tsx) | Platform composition / entry point | `routing/RouteStatusFallback` |

## Validation

- Shared UI and platform Vitest: **160 files, 614 tests passed**.
- Responsive and authenticated axe suites: **23 tests passed**, including 375/768/1440px layouts and LTR/RTL coverage.
- Platform admin-management and workspace lifecycle suites: **2 tests passed** using the suites' temporary records.
- Frontend ESLint: passed.
- Frontend typecheck and monorepo typecheck: passed.
- BiDi scan: **3,341 files**, passed.
- Diff whitespace check: passed.

The architecture checks inventory every platform TSX file. Browser tests exercise representative flows; they do not prove every possible UI state or every semantically similar implementation is unique.
