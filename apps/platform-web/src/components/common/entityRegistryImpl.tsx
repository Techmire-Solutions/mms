import type {
  FieldValueType,
  BadgeTone,
  FieldBadgeConfig,
  FieldDefinition,
  EntityDrawerSection,
  TableColumnDescriptor,
  EntityDescriptor,
  CreateEntityDescriptorOptions,
} from "@mms/fe-core/components/entityRegistryTypes";
import { createEntityDescriptor } from "@mms/fe-core/components/entityDescriptorFactory";
import {
  contactsEntityDescriptor,
  attendanceEntityDescriptor,
  enrollmentsEntityDescriptor,
  platformWorkspacesEntityDescriptor,
  platformUsersEntityDescriptor,
  platformSettingsEntityDescriptor,
  questionBankEntityDescriptor,
  usersEntityDescriptor,
  examinationsEntityDescriptor,
} from "./descriptors";

export type EntityRegistryMap = {
  contacts: typeof contactsEntityDescriptor;
  attendance: typeof attendanceEntityDescriptor;
  enrollments: typeof enrollmentsEntityDescriptor;
  platformWorkspaces: typeof platformWorkspacesEntityDescriptor;
  platformUsers: typeof platformUsersEntityDescriptor;
  platformSettings: typeof platformSettingsEntityDescriptor;
  questionBank: typeof questionBankEntityDescriptor;
  users: typeof usersEntityDescriptor;
  examinations: typeof examinationsEntityDescriptor;
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
  attendanceEntityDescriptor,
  enrollmentsEntityDescriptor,
  platformWorkspacesEntityDescriptor,
  platformUsersEntityDescriptor,
  platformSettingsEntityDescriptor,
  questionBankEntityDescriptor,
  usersEntityDescriptor,
  examinationsEntityDescriptor,
};

export const ENTITY_REGISTRY = {
  contacts: contactsEntityDescriptor,
  attendance: attendanceEntityDescriptor,
  enrollments: enrollmentsEntityDescriptor,
  platformWorkspaces: platformWorkspacesEntityDescriptor,
  platformUsers: platformUsersEntityDescriptor,
  platformSettings: platformSettingsEntityDescriptor,
  questionBank: questionBankEntityDescriptor,
  users: usersEntityDescriptor,
  examinations: examinationsEntityDescriptor,
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
