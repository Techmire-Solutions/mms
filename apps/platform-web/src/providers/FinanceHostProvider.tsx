import React from "react";
import {
  FinanceHostProvider,
  type FinanceHostHook,
  type FinanceHostValue,
} from "@mms/mod-billing/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useFinanceConfig } from "@/hooks/useStandardModuleConfig";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useDocumentCurrency } from "@/tenant/hooks/useDocumentCurrency";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useCurrency, useFinanceCurrency } from "@/hooks/useCurrency";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useWorkDrillDownListener } from "@/lib/query/useWorkDrillDownListener";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import * as sessions from "@/tenant/hooks/collections/sessions";
import * as accounting from "@/tenant/hooks/collections/accounting";
import * as students from "@/tenant/hooks/collections/students";
import { UserActorSelect } from "@/tenant/components/selectors/UserActorSelect";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";
import { SessionClassSectionSelect } from "@/components/common/SessionClassSectionSelect";
import { WorkListFiltersScaffold } from "@/components/common";
import { ModuleReportsTier } from "@/tenant/components/moduleReports";
import TenantMessageComposer from "@/tenant/components/messaging/TenantMessageComposer";

/** Binds the app's RBAC, currency, collections, and shared UI into the billing module host. */
export function FinanceHostBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <FinanceHostProvider
      value={{
        usePermissions,
        useModulePermissions,
        useFinanceConfig,
        useBranding,
        useDocumentCurrency: useDocumentCurrency as unknown as FinanceHostHook,
        useModuleSettingsEditor: useModuleSettingsEditor as unknown as FinanceHostHook,
        useCurrency,
        useFinanceCurrency,
        useMessageComposerState,
        useWorkDrillDownListener: useWorkDrillDownListener as unknown as FinanceHostHook,
        useGenericModuleExport: useGenericModuleExport as unknown as FinanceHostHook,
        sessionsCollection: sessions as unknown as Record<string, FinanceHostHook>,
        accountingCollection: accounting as unknown as Record<string, FinanceHostHook>,
        studentsCollection: students as unknown as Record<string, FinanceHostHook>,
        UserActorSelect: UserActorSelect as unknown as FinanceHostValue["UserActorSelect"],
        RegistryPersonSelect:
          RegistryPersonSelect as unknown as FinanceHostValue["RegistryPersonSelect"],
        SessionClassSectionSelect:
          SessionClassSectionSelect as unknown as FinanceHostValue["SessionClassSectionSelect"],
        WorkListFiltersScaffold:
          WorkListFiltersScaffold as unknown as FinanceHostValue["WorkListFiltersScaffold"],
        ModuleReportsTier: ModuleReportsTier as unknown as FinanceHostValue["ModuleReportsTier"],
        TenantMessageComposer:
          TenantMessageComposer as unknown as FinanceHostValue["TenantMessageComposer"],
      }}
    >
      {children}
    </FinanceHostProvider>
  );
}
