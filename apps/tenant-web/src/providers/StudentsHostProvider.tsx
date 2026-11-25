import React from "react";
import {
  configureStudentsHost,
  type StudentsHostHook,
  type StudentsHostValue,
} from "@mms/mod-students/frontend/tenant/host";
import {
  formatLocalizedRelationshipLabel,
  formatLocalizedRelationshipParts,
} from "@mms/mod-contacts/frontend/tenant/lib/formatLocalizedRelationshipLabel";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useStudentConfig } from "@/hooks/useStandardModuleConfig";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import { useModuleTierPageNav } from "@/tenant/hooks/useModuleTierPageNav";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useCurrency, useFinanceCurrency } from "@/hooks/useCurrency";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import { useWorkDrillDownListener } from "@/lib/query/useWorkDrillDownListener";
import * as contacts from "@/tenant/hooks/collections/contacts";
import * as sessions from "@/tenant/hooks/collections/sessions";
import * as enrollments from "@/tenant/hooks/collections/enrollments";
import * as invoiceTemplateStore from "@/lib/invoiceTemplateStore";
import * as printBrandingTokens from "@/lib/ui/printBrandingTokens";
import ContactPicker from "@/components/contactLink/ContactPicker";
import ContactEditModal from "@/components/contactLink/ContactEditModal";
import { ModuleTierPage } from "@/components/app/ModuleTierPage";
import { ModuleReportsTier } from "@/tenant/components/moduleReports";
import TenantMessageComposerLauncher from "@/tenant/components/messaging/TenantMessageComposerLauncher";

/** Binds the app's RBAC, config, collections, templates, and overlays into the students module host. */
export function StudentsHostBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  configureStudentsHost({
    usePermissions,
    useModulePermissions,
    useStudentConfig,
    useBranding,
    useModuleSettingsEditor: useModuleSettingsEditor as unknown as StudentsHostHook,
    useModuleTierPageNav: useModuleTierPageNav as unknown as StudentsHostHook,
    useAcademicTerms,
    useMessageComposerState,
    useCurrency,
    useFinanceCurrency,
    formatLocalizedRelationshipLabel:
      formatLocalizedRelationshipLabel as unknown as StudentsHostHook,
    formatLocalizedRelationshipParts:
      formatLocalizedRelationshipParts as unknown as StudentsHostHook,
    useGenericModuleExport: useGenericModuleExport as unknown as StudentsHostHook,
    useWorkDrillDownListener: useWorkDrillDownListener as unknown as StudentsHostHook,
    contactsCollection: contacts as unknown as Record<string, StudentsHostHook>,
    sessionsCollection: sessions as unknown as Record<string, StudentsHostHook>,
    enrollmentsCollection: enrollments as unknown as Record<string, StudentsHostHook>,
    invoiceTemplateStore: invoiceTemplateStore as unknown as Record<string, unknown>,
    printBrandingTokens: printBrandingTokens as unknown as Record<string, unknown>,
    ContactPicker: ContactPicker as unknown as StudentsHostValue["ContactPicker"],
    ContactEditModal: ContactEditModal as unknown as StudentsHostValue["ContactEditModal"],
    ModuleTierPage: ModuleTierPage as unknown as StudentsHostValue["ModuleTierPage"],
    ModuleReportsTier: ModuleReportsTier as unknown as StudentsHostValue["ModuleReportsTier"],
    TenantMessageComposerLauncher:
      TenantMessageComposerLauncher as unknown as StudentsHostValue["TenantMessageComposerLauncher"],
  });
  return <>{children}</>;
}
