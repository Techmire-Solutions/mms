import type {
  FieldValueType,
  BadgeTone,
  FieldBadgeConfig,
  FieldDefinition,
  EntityDrawerSection,
  TableColumnDescriptor,
  EntityDescriptor,
  CreateEntityDescriptorOptions,
} from "@/components/common/entityRegistryTypes";
import { createEntityDescriptor } from "./entityDescriptorFactory";
import {
  contactsEntityDescriptor,
  studentsEntityDescriptor,
  facultyEntityDescriptor,
  sessionsEntityDescriptor,
  financeEntityDescriptor,
  attendanceEntityDescriptor,
  enrollmentsEntityDescriptor,
  hasanatEntityDescriptor,
  obligationsEntityDescriptor,
  platformWorkspacesEntityDescriptor,
  platformUsersEntityDescriptor,
  platformSettingsEntityDescriptor,
  questionBankEntityDescriptor,
  usersEntityDescriptor,
  examinationsEntityDescriptor,
  messagingEntityDescriptor,
} from "./descriptors";

export type EntityRegistryMap = {
  contacts: typeof contactsEntityDescriptor;
  students: typeof studentsEntityDescriptor;
  faculty: typeof facultyEntityDescriptor;
  sessions: typeof sessionsEntityDescriptor;
  finance: typeof financeEntityDescriptor;
  attendance: typeof attendanceEntityDescriptor;
  enrollments: typeof enrollmentsEntityDescriptor;
  hasanat: typeof hasanatEntityDescriptor;
  obligations: typeof obligationsEntityDescriptor;
  platformWorkspaces: typeof platformWorkspacesEntityDescriptor;
  platformUsers: typeof platformUsersEntityDescriptor;
  platformSettings: typeof platformSettingsEntityDescriptor;
  questionBank: typeof questionBankEntityDescriptor;
  users: typeof usersEntityDescriptor;
  examinations: typeof examinationsEntityDescriptor;
  messaging: typeof messagingEntityDescriptor;
};

export type {
  FieldValueType,
  BadgeTone,
  FieldBadgeConfig,
  FieldDefinition,
  EntityDrawerSection,
  TableColumnDescriptor,
  EntityDescriptor,
  CreateEntityDescriptorOptions,
};

export { createEntityDescriptor };

export {
  contactsEntityDescriptor,
  studentsEntityDescriptor,
  facultyEntityDescriptor,
  sessionsEntityDescriptor,
  financeEntityDescriptor,
  attendanceEntityDescriptor,
  enrollmentsEntityDescriptor,
  hasanatEntityDescriptor,
  obligationsEntityDescriptor,
  platformWorkspacesEntityDescriptor,
  platformUsersEntityDescriptor,
  platformSettingsEntityDescriptor,
  questionBankEntityDescriptor,
  usersEntityDescriptor,
  examinationsEntityDescriptor,
  messagingEntityDescriptor,
};

export const ENTITY_REGISTRY = {
  contacts: contactsEntityDescriptor,
  students: studentsEntityDescriptor,
  faculty: facultyEntityDescriptor,
  sessions: sessionsEntityDescriptor,
  finance: financeEntityDescriptor,
  attendance: attendanceEntityDescriptor,
  enrollments: enrollmentsEntityDescriptor,
  hasanat: hasanatEntityDescriptor,
  obligations: obligationsEntityDescriptor,
  platformWorkspaces: platformWorkspacesEntityDescriptor,
  platformUsers: platformUsersEntityDescriptor,
  platformSettings: platformSettingsEntityDescriptor,
  questionBank: questionBankEntityDescriptor,
  users: usersEntityDescriptor,
  examinations: examinationsEntityDescriptor,
  messaging: messagingEntityDescriptor,
} satisfies EntityRegistryMap;

/**
 * Global accessor for entity descriptors by domain entity key.
 */
export function getEntityDescriptor<K extends keyof EntityRegistryMap>(
  entityType: K,
): EntityRegistryMap[K];
export function getEntityDescriptor(entityType: string): EntityDescriptor<unknown> | undefined;
export function getEntityDescriptor(entityType: string): EntityDescriptor<unknown> | undefined {
  return ENTITY_REGISTRY[entityType as keyof EntityRegistryMap] as
    EntityDescriptor<unknown> | undefined;
}
