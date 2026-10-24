import { createColumnRegistry, type ModuleColumnRegistryEntry } from "./moduleColumnCore.js";

export interface UsersWorkColumnLabels {
  user: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  created: string;
  twoFactor: string;
}

/** Builds tenant-default Work column registry for Users directory. */
export function buildUsersWorkColumnRegistry(
  labels: UsersWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["user", "email", "role", "status", "lastLogin", "created", "twoFactor"],
    labels,
  );
}

export interface UsersActivityWorkColumnLabels {
  time: string;
  user: string;
  action: string;
  detail: string;
  ip: string;
}

/** Builds tenant-default Work column registry for Users activity log. */
export function buildUsersActivityWorkColumnRegistry(
  labels: UsersActivityWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(["time", "user", "action", "detail", "ip"], labels);
}

export interface MessagingRecipientsWorkColumnLabels {
  recipient: string;
  phone: string;
  email: string;
}

/** Builds tenant-default Work column registry for Messaging compose recipient picker. */
export function buildMessagingRecipientsWorkColumnRegistry(
  labels: MessagingRecipientsWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(["recipient", "phone", "email"], labels);
}

export interface MessagingHistoryWorkColumnLabels {
  recipient: string;
  channel: string;
  body: string;
  dateSent: string;
}

/** Builds tenant-default Work column registry for Messaging sent history. */
export function buildMessagingHistoryWorkColumnRegistry(
  labels: MessagingHistoryWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(["recipient", "channel", "body", "dateSent"], labels);
}

export interface MessagingTemplatesWorkColumnLabels {
  label: string;
  category: string;
  channel: string;
  body: string;
}

/** Builds tenant-default Work column registry for Messaging templates setup table. */
export function buildMessagingTemplatesWorkColumnRegistry(
  labels: MessagingTemplatesWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(["label", "category", "channel", "body"], labels);
}
