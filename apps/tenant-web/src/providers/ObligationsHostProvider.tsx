import React from "react";
import { configureObligationsHost } from "@mms/mod-obligations/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useContactsByIds } from "@/tenant/hooks/collections/contacts";
import { useUsersByIds } from "@/tenant/hooks/collections/users";
import * as accountingCollection from "@/tenant/hooks/collections/accounting";
import { ReportChartCard, ReportDataGridContainer } from "@/tenant/components/moduleReports";
import { PinnedWidgets } from "@/tenant/components/reports";
import { UserActorSelect } from "@/tenant/components/selectors/UserActorSelect";
import { TenantMessageComposer as MessageComposer } from "@/tenant/components/messaging/TenantMessageComposer";
import ContactPicker from "@/components/contactLink/ContactPicker";

/** Binds the app accounting keys, reports widgets and messaging composer into the obligations host. */
export function ObligationsHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  configureObligationsHost({
    usePermissions,
    useModulePermissions,
    useFinanceCurrency,
    useMessageComposerState,
    useGenericModuleExport,
    useBrandPalette,
    useBranding,
    useContactsByIds,
    useUsersByIds,
    accountingCollection: accountingCollection as unknown as Record<string, unknown>,
    ReportChartCard: ReportChartCard as unknown as React.ComponentType<Record<string, unknown>>,
    ReportDataGridContainer: ReportDataGridContainer as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    PinnedWidgets: PinnedWidgets as unknown as React.ComponentType<Record<string, unknown>>,
    UserActorSelect: UserActorSelect as unknown as React.ComponentType<Record<string, unknown>>,
    MessageComposer: MessageComposer as unknown as React.ComponentType<Record<string, unknown>>,
    ContactPicker: ContactPicker as unknown as React.ComponentType<Record<string, unknown>>,
  });
  return <>{children}</>;
}
