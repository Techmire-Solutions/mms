/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { configureIamHost } from "@mms/mod-iam/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { useWorkspaceToday } from "@/hooks/useWorkspaceToday";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useContactById } from "@/tenant/hooks/collections/contacts";
import { useUsersContractVerifyEmail } from "@/tenant/hooks/collections/users";
import { useTenantProfile } from "@/tenant/hooks/useTenantProfile";
import * as reportDateUtils from "@/lib/reports/reportDateUtils";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { TenantMessageComposerLauncher } from "@/tenant/components/messaging/TenantMessageComposerLauncher";
import { ReportDataGridContainer } from "@/tenant/components/moduleReports";

/** Binds the app's RBAC, config, collections, composer and reports surfaces into the IAM host. */
export function IamHostBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  configureIamHost({
    usePermissions,
    useModulePermissions,
    useWorkspaceRoles,
    useGlobalSettings,
    useModuleSettingsEditor,
    useUsersConfig,
    useWorkspaceToday,
    useMessageComposerState,
    useContactById,
    useUsersContractVerifyEmail,
    useTenantProfile,
    reportDateUtils: reportDateUtils as unknown as {
      calculateReportDateRange: (...args: unknown[]) => unknown;
    },
    ContactPicker: ContactPicker as unknown as React.ComponentType<Record<string, never>>,
    TenantMessageComposerLauncher: TenantMessageComposerLauncher as unknown as React.ComponentType<
      Record<string, never>
    >,
    ReportDataGridContainer: ReportDataGridContainer as unknown as React.ComponentType<
      Record<string, never>
    >,
  });
  return <>{children}</>;
}
