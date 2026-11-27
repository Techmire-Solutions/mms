import {
  configureAnalyticsHost,
  type AnalyticsHostValue,
} from "@mms/mod-analytics/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useCurrency, useFinanceCurrency } from "@/hooks/useCurrency";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import * as savedReportsSource from "@/hooks/useSavedReportsSource";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { useIsAdminViewer } from "@/tenant/hooks/useViewerRole";
import * as accounting from "@/tenant/hooks/collections/accounting";
import * as attendance from "@/tenant/hooks/collections/attendance";
import * as contacts from "@/tenant/hooks/collections/contacts";
import * as enrollments from "@/tenant/hooks/collections/enrollments";
import * as examinations from "@/tenant/hooks/collections/examinations";
import * as faculty from "@/tenant/hooks/collections/faculty";
import * as finance from "@/tenant/hooks/collections/finance";
import * as hasanat from "@/tenant/hooks/collections/hasanat";
import * as messaging from "@/tenant/hooks/collections/messaging";
import * as obligations from "@/tenant/hooks/collections/obligations";
import * as questionBank from "@/tenant/hooks/collections/questionBank";
import * as sessions from "@/tenant/hooks/collections/sessions";
import * as students from "@/tenant/hooks/collections/students";
import * as users from "@/tenant/hooks/collections/users";
import * as dashboardWidgets from "@/components/dashboard-widgets/registry";
import * as charts from "@/components/dashboard-widgets/charts/chartPrimitives";
import * as appDb from "@/lib/db";
import * as dashboardWidgetLib from "@/lib/dashboardWidgets";
import * as facultyAssignment from "@/lib/faculty/facultyAssignment";
import * as facultyStatusUi from "@/lib/faculty/facultyStatusUi";
import * as studentStatusUi from "@/lib/students/studentStatusUi";
import * as enrollmentStatusBadge from "@/lib/ui/enrollmentStatusBadge";
import * as chartDirection from "@/lib/ui/chartDirection";
import * as buildDashboardNotifications from "@/lib/buildDashboardNotifications";
import * as settingsDeepLink from "@/lib/config/settingsDeepLink";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useModuleAccess } from "@/tenant/hooks/useModuleAccess";
import { useContactConfig } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";
import * as pinnedWidgetsFacade from "@/tenant/components/reports/pinnedWidgetsFacade";
import { useNotificationReadState } from "@/tenant/hooks/notifications/useNotificationReadState";
import { useOpenTenantNotification } from "@/tenant/hooks/notifications/useOpenTenantNotification";
import * as moduleReportAdapters from "@/tenant/components/reports/moduleReportAdapters";
import { ChartTooltip, ChartTooltipRow } from "@/components/app/ChartTooltip";
import SessionsTable from "@/components/dashboard-widgets/SessionsTable";
import { MessagingReportsVolumeChart } from "@/tenant/components/reports/MessagingReportsVolumeChart";

/** Binds the app's report collections, widget registry and report libs into the analytics host. */
export function bindAnalyticsHost(): void {
  configureAnalyticsHost({
    useCurrency,
    useFinanceCurrency,
    useDashboardConfig,
    useSavedReportsSource: savedReportsSource.useGenericSavedReportsSource,
    useBrandPalette,
    usePermissions,
    useModulePermissions,
    useIsAdminViewer,
    collections: {
      accounting: accounting as unknown as Record<string, unknown>,
      attendance: attendance as unknown as Record<string, unknown>,
      contacts: contacts as unknown as Record<string, unknown>,
      enrollments: enrollments as unknown as Record<string, unknown>,
      examinations: examinations as unknown as Record<string, unknown>,
      faculty: faculty as unknown as Record<string, unknown>,
      finance: finance as unknown as Record<string, unknown>,
      hasanat: hasanat as unknown as Record<string, unknown>,
      messaging: messaging as unknown as Record<string, unknown>,
      obligations: obligations as unknown as Record<string, unknown>,
      questionBank: questionBank as unknown as Record<string, unknown>,
      sessions: sessions as unknown as Record<string, unknown>,
      students: students as unknown as Record<string, unknown>,
      users: users as unknown as Record<string, unknown>,
      hostHooks: {
        useBranding,
        useOpenTenantNotification,
        useNotificationReadState,
        useModuleAccess,
      },
    } as unknown as AnalyticsHostValue["collections"],
    ChartTooltip: ChartTooltip as unknown as React.ComponentType<Record<string, unknown>>,
    ChartTooltipRow: ChartTooltipRow as unknown as React.ComponentType<Record<string, unknown>>,
    SessionsTable: SessionsTable as unknown as React.ComponentType<Record<string, unknown>>,
    MessagingReportsVolumeChart: MessagingReportsVolumeChart as unknown as React.ComponentType<
      Record<string, unknown>
    >,
    dashboardWidgetRegistry: {
      ...(dashboardWidgets as unknown as Record<string, unknown>),
      ...(charts as unknown as Record<string, unknown>),
    },
    reportModuleAdapters: moduleReportAdapters as unknown as Record<
      string,
      React.ComponentType<Record<string, unknown>>
    >,
    reportLibs: {
      ...appDb,
      ...dashboardWidgetLib,
      ...facultyAssignment,
      ...facultyStatusUi,
      ...studentStatusUi,
      ...enrollmentStatusBadge,
      ...chartDirection,
      ...buildDashboardNotifications,
      ...settingsDeepLink,
      ...(pinnedWidgetsFacade as unknown as Record<string, unknown>),
      useBranding,
      useContactConfig,
      useOpenTenantNotification,
      useNotificationReadState,
      useModuleAccess,
      useGenericSavedReportsSource: savedReportsSource.useGenericSavedReportsSource,
    },
  });
}
