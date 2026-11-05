import {
  createColumnRegistry,
  type ModuleColumnKind,
  type ModuleColumnRegistryEntry,
} from "./moduleColumnCore.js";

export interface UsersWorkColumnLabels {
  user: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
  created: string;
  twoFactor: string;
}

const USERS_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  user: "identity",
  email: "email",
  role: "status",
  status: "status",
  lastLogin: "dateTime",
  created: "date",
  twoFactor: "boolean",
};

/** Builds tenant-default Work column registry for Users directory. */
export function buildUsersWorkColumnRegistry(
  labels: UsersWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["user", "email", "role", "status", "lastLogin", "created", "twoFactor"],
    labels,
    true,
    USERS_COLUMN_KINDS,
  );
}

export interface UsersActivityWorkColumnLabels {
  time: string;
  user: string;
  action: string;
  detail: string;
  ip: string;
}

const USERS_ACTIVITY_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  time: "dateTime",
  user: "person",
  action: "shortText",
  detail: "longText",
  ip: "reference",
};

/** Builds tenant-default Work column registry for Users activity log. */
export function buildUsersActivityWorkColumnRegistry(
  labels: UsersActivityWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["time", "user", "action", "detail", "ip"],
    labels,
    true,
    USERS_ACTIVITY_COLUMN_KINDS,
  );
}

export interface MessagingRecipientsWorkColumnLabels {
  recipient: string;
  phone: string;
  email: string;
}

const MESSAGING_RECIPIENTS_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  recipient: "person",
  phone: "shortText",
  email: "email",
};

/** Builds tenant-default Work column registry for Messaging compose recipient picker. */
export function buildMessagingRecipientsWorkColumnRegistry(
  labels: MessagingRecipientsWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["recipient", "phone", "email"],
    labels,
    true,
    MESSAGING_RECIPIENTS_COLUMN_KINDS,
  );
}

export interface MessagingHistoryWorkColumnLabels {
  recipient: string;
  channel: string;
  body: string;
  dateSent: string;
}

const MESSAGING_HISTORY_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  recipient: "person",
  channel: "status",
  body: "longText",
  dateSent: "dateTime",
};

/** Builds tenant-default Work column registry for Messaging sent history. */
export function buildMessagingHistoryWorkColumnRegistry(
  labels: MessagingHistoryWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["recipient", "channel", "body", "dateSent"],
    labels,
    true,
    MESSAGING_HISTORY_COLUMN_KINDS,
  );
}

export interface MessagingTemplatesWorkColumnLabels {
  label: string;
  category: string;
  channel: string;
  body: string;
}

const MESSAGING_TEMPLATES_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  label: "title",
  category: "shortText",
  channel: "status",
  body: "longText",
};

/** Builds tenant-default Work column registry for Messaging templates setup table. */
export function buildMessagingTemplatesWorkColumnRegistry(
  labels: MessagingTemplatesWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["label", "category", "channel", "body"],
    labels,
    true,
    MESSAGING_TEMPLATES_COLUMN_KINDS,
  );
}
