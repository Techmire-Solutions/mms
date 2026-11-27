import React from "react";
import { configureQuestionBankHost } from "@mms/mod-question-bank/frontend/tenant/host";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { STANDARD_MODULES_CONFIG_REGISTRY } from "@/hooks/standardModuleConfigRegistry";
import { WorkBatchTable, WorkTaskToolbar } from "@/components/common";
import {
  SessionClassSectionSelect,
  sessionIdForClass,
} from "@/components/common/SessionClassSectionSelect";
import { ReportChartCard, ReportDataGridContainer } from "@/tenant/components/moduleReports";

/** Binds the app session picker, reports and settings surfaces into the question-bank host. */
export function QuestionBankHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  configureQuestionBankHost({
    useStaticEntityDescriptor,
    useGenericModuleExport,
    useSessionsCollection,
    useModuleSettingsEditor,
    useModulePermissions,
    standardModulesConfigRegistry: STANDARD_MODULES_CONFIG_REGISTRY as unknown as Record<
      string,
      unknown
    >,
    WorkBatchTable: WorkBatchTable as unknown as React.ComponentType<Record<string, never>>,
    WorkTaskToolbar: WorkTaskToolbar as unknown as React.ComponentType<Record<string, never>>,
    SessionClassSectionSelect: SessionClassSectionSelect as unknown as React.ComponentType<
      Record<string, never>
    >,
    sessionIdForClass,
    ReportChartCard: ReportChartCard as unknown as React.ComponentType<Record<string, never>>,
    ReportDataGridContainer: ReportDataGridContainer as unknown as React.ComponentType<
      Record<string, never>
    >,
  });
  return <>{children}</>;
}
