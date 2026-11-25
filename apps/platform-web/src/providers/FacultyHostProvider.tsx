import React from "react";
import { FacultyHostProvider } from "@mms/mod-faculty/frontend/tenant/host";
import { configureFacultyCrossModuleKeys } from "@mms/mod-faculty/frontend/tenant/crossModuleKeys";
import { useFacultyConfig } from "@/hooks/useStandardModuleConfig";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useWorkspaceToday } from "@/hooks/useWorkspaceToday";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useIndustryTerminology } from "@/tenant/hooks/useIndustryTerminology";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { useModuleSettingsEditor } from "@/tenant/hooks/useModuleSettingsEditor";
import * as users from "@/tenant/hooks/collections/users";
import { configureFacultyUsersInvalidator } from "@mms/mod-faculty/frontend/tenant/host/usersInvalidation";
import * as sessions from "@/tenant/hooks/collections/sessions";
import * as contacts from "@/tenant/hooks/collections/contacts";
import * as students from "@/tenant/hooks/collections/students";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { ModuleTierPage } from "@/components/app/ModuleTierPage";
import { ModuleReports, KPISummary } from "@/tenant/components/moduleReports";
import TenantMessageComposer from "@/tenant/components/messaging/TenantMessageComposer";

configureFacultyUsersInvalidator(users.invalidateUsersQueries);

configureFacultyCrossModuleKeys({
  contacts: contacts.CONTACTS_QUERY_KEY,
  students: students.STUDENTS_QUERY_KEY,
});

/** Binds the app's RBAC + cross-feature collections into the faculty module host. */
export function FacultyHostBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <FacultyHostProvider
      value={{
        useFacultyConfig,
        useWorkspaceRoles,
        usePermissions,
        useModulePermissions,
        useWorkspaceToday,
        useBranding,
        useIndustryTerminology,
        useMessageComposerState,
        useModuleSettingsEditor,
        users: {
          useUsersContractList: users.useUsersContractList,
          useCreateWorkspaceRole: users.useCreateWorkspaceRole,
          RoleFormModal: users.RoleFormModal,
        },
        sessions: {
          useSessions: sessions.useSessions,
          useSessionsCollection: sessions.useSessionsCollection,
        },
        contacts: { useContactById: contacts.useContactById },
        ContactPicker: ContactPicker,
        ModuleTierPage: ModuleTierPage,
        ModuleReports: ModuleReports,
        KPISummary: KPISummary,
        TenantMessageComposer: TenantMessageComposer,
      }}
    >
      {children}
    </FacultyHostProvider>
  );
}
