import React from "react";
import { ContactsHostProvider } from "@mms/mod-contacts/frontend/tenant/host";
import { configureContactsCrossModuleQueryKeys } from "@mms/mod-contacts/frontend/tenant/crossModuleQueryKeys";
import { useModulePermissions, usePermissions } from "@/tenant/hooks/usePermissions";
import { useModuleTierPageNav } from "@/tenant/hooks/useModuleTierPageNav";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { ModuleTierPage } from "@/components/app/ModuleTierPage";
import TenantMessageComposer from "@/tenant/components/messaging/TenantMessageComposer";
import { ModuleReportsTier } from "@/tenant/components/moduleReports";
import {
  useContactMutations,
  useContactPickerOption,
  useContactPickerSearch,
} from "@/tenant/hooks/collections/contacts";
import {
  useContactPreferencesQuery,
  useContactPreferencesMutation,
} from "@mms/mod-contacts/frontend/tenant/hooks/useContactSetupConfig";
import {
  useContactLookupsQuery,
  useContactLookupMutation,
} from "@mms/mod-contacts/frontend/tenant/hooks/useContactLookups";
import {
  useContactsContractFieldConfig,
  useContactsContractUpdateFieldConfig,
} from "@mms/mod-contacts/frontend/tenant/hooks/useContactsQueries";
import {
  MESSAGING_CONTACTS_RESOLVE_QUERY_KEY,
  MESSAGING_RECIPIENTS_QUERY_KEY,
} from "@/tenant/hooks/collections/messaging";
import {
  STUDENTS_METRICS_QUERY_KEY,
  STUDENTS_QUERY_KEY,
} from "@mms/mod-students/frontend/tenant/hooks/studentsQueryKeys";

configureContactsCrossModuleQueryKeys({
  messagingContactsResolve: MESSAGING_CONTACTS_RESOLVE_QUERY_KEY,
  messagingRecipients: MESSAGING_RECIPIENTS_QUERY_KEY,
  studentsMetrics: STUDENTS_METRICS_QUERY_KEY,
  students: STUDENTS_QUERY_KEY,
});

/**
 * Binds the app's RBAC + contacts query hooks into the module's host context so
 * the relocated contacts UI stays free of `@/` imports.
 */
export function ContactsHostBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ContactsHostProvider
      value={{
        usePermissions,
        useModulePermissions,
        useContactMutations,
        useModuleTierPageNav,
        useMessageComposerState,
        ModuleTierPage,
        TenantMessageComposer,
        ModuleReportsTier,
        useContactPickerSearch,
        useContactPickerOption,
        useContactPreferencesQuery,
        useContactPreferencesMutation,
        useContactLookupsQuery,
        useContactLookupMutation,
        useContactsContractFieldConfig,
        useContactsContractUpdateFieldConfig,
      }}
    >
      {children}
    </ContactsHostProvider>
  );
}
