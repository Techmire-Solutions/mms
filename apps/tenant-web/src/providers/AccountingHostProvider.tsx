import React from "react";
import {
  configureAccountingHost,
  type AccountingHostValue,
} from "@mms/mod-accounting/frontend/tenant/host";
import {
  FinancialDebitCreditFooter,
  MutedTableHeaderRow,
} from "@mms/fe-core/components/FinancialDebitCreditTableChrome";
import { useAccountingCurrency } from "@/hooks/useCurrency";
import { useAccountingConfig } from "@/hooks/useStandardModuleConfig";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useDocumentCurrency } from "@/tenant/hooks/useDocumentCurrency";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useModulePermissions, usePermissions } from "@/tenant/hooks/usePermissions";
import { facultyResolveQueryOptions } from "@/tenant/hooks/collections/faculty";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";
import { ModuleReportsTier, ReportDataGridContainer } from "@/tenant/components/moduleReports";
import { PinnedWidgets } from "@/tenant/components/reports";

function useBoundAccountingCurrency(): ReturnType<AccountingHostValue["useAccountingCurrency"]> {
  const base = useAccountingCurrency();
  return {
    ...base,
    format: (value: number) => base.formatCurrency(value),
    currency: base.activeCurrency.code,
  };
}

/** Binds the app's currency, config, RBAC, faculty lookups, and report widgets into the accounting host. */
export function AccountingHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  configureAccountingHost({
    useAccountingCurrency: useBoundAccountingCurrency,
    useAccountingConfig:
      useAccountingConfig as unknown as AccountingHostValue["useAccountingConfig"],
    useGenericModuleExport:
      useGenericModuleExport as unknown as AccountingHostValue["useGenericModuleExport"],
    useBrandPalette,
    useBranding,
    useDocumentCurrency:
      useDocumentCurrency as unknown as AccountingHostValue["useDocumentCurrency"],
    useModuleSettingsEditor:
      useModuleSettingsEditor as unknown as AccountingHostValue["useModuleSettingsEditor"],
    useModulePermissions:
      useModulePermissions as unknown as AccountingHostValue["useModulePermissions"],
    usePermissions: usePermissions as unknown as AccountingHostValue["usePermissions"],
    facultyResolveQueryOptions:
      facultyResolveQueryOptions as unknown as AccountingHostValue["facultyResolveQueryOptions"],
    RegistryPersonSelect:
      RegistryPersonSelect as unknown as AccountingHostValue["RegistryPersonSelect"],
    ReportDataGridContainer:
      ReportDataGridContainer as unknown as AccountingHostValue["ReportDataGridContainer"],
    ModuleReportsTier: ModuleReportsTier as unknown as AccountingHostValue["ModuleReportsTier"],
    PinnedWidgets: PinnedWidgets as unknown as AccountingHostValue["PinnedWidgets"],
    MutedTableHeaderRow:
      MutedTableHeaderRow as unknown as AccountingHostValue["MutedTableHeaderRow"],
    FinancialDebitCreditTableChrome:
      FinancialDebitCreditFooter as unknown as AccountingHostValue["FinancialDebitCreditTableChrome"],
  });
  return <>{children}</>;
}
