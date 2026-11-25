import React from "react";
import { HasanatHostProvider } from "@mms/mod-hasanat/frontend/tenant/host";
import { useModulePermissions, usePermissions } from "@/tenant/hooks/usePermissions";
import { useHasanatConfig } from "@/hooks/useStandardModuleConfig";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useWorkspaceToday } from "@/hooks/useWorkspaceToday";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { ModuleReportsTier } from "@/tenant/components/moduleReports";
import TenantMessageComposer from "@/tenant/components/messaging/TenantMessageComposer";
import { UserActorSelect } from "@/tenant/components/selectors/UserActorSelect";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";
import {
  SessionClassSectionSelect,
  sessionIdForClass,
} from "@/components/common/SessionClassSectionSelect";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { hasanatEntityDescriptor } from "@/components/common/entityRegistry";

/** Binds the app's RBAC + hasanat query surface into the module host context. */
export function HasanatHostBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <HasanatHostProvider
      value={{
        usePermissions,
        useModulePermissions,
        useHasanatConfig,
        useGenericModuleExport,
        useBrandPalette,
        useMessageComposerState,
        useBranding,
        useWorkspaceToday,
        useSessionsCollection,
        useModuleSettingsEditor,
        ModuleReportsTier,
        TenantMessageComposer,
        UserActorSelect,
        RegistryPersonSelect,
        SessionClassSectionSelect,
        useStaticEntityDescriptor,
        hasanatEntityDescriptor,
        sessionIdForClass,
      }}
    >
      {children}
    </HasanatHostProvider>
  );
}
