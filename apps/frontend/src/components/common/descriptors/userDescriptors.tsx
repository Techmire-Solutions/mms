import { USER_STATUS_REGISTRY, type SystemUser } from "@mms/shared";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { EntityDescriptor, FieldBadgeConfig } from "@/components/common/entityRegistryTypes";
import { createEntityDescriptor } from "../entityDescriptorFactory";

/** Badge configs derived from the shared USER_STATUS_REGISTRY — never re-declared per surface. */
const userStatusBadgeMap: Record<string, FieldBadgeConfig> = Object.fromEntries(
  USER_STATUS_REGISTRY.map((status) => [
    status.id,
    {
      label: status.id.charAt(0).toUpperCase() + status.id.slice(1),
      tone: status.badgeVariant,
      className: SEMANTIC_BADGE[status.badgeVariant],
    },
  ]),
);

const twoFactorBadgeMap: Record<string, FieldBadgeConfig> = {
  true: { label: "On", tone: "success", className: SEMANTIC_BADGE.success },
  false: { label: "Off", tone: "muted", className: SEMANTIC_BADGE.muted },
};

/**
 * Users module SSOT descriptor.
 *
 * Card metadata consumes this via columns-from-descriptor mode in
 * `UserCardMetadata` — values are rendered by `renderUserWorkColumnValue`
 * because role/status/2FA badge labels require runtime translation and
 * workspace roles, which the static descriptor render path cannot localize.
 */
export const usersEntityDescriptor: EntityDescriptor<SystemUser> =
  createEntityDescriptor<SystemUser>({
    entityType: "users",
    singularLabel: "User",
    pluralLabel: "Users",
    idField: "id",
    titleField: "name",
    fields: [
      {
        key: "name",
        label: "User",
        labelKey: "users.colUser",
        type: "text",
        sortable: true,
        defaultVisibleInTable: true,
        tableOrder: 10,
        fixed: true,
        cardSlot: "hidden",
        drawerSection: "basic",
        drawerOrder: 10,
      },
      {
        key: "role",
        label: "Role",
        labelKey: "users.colRole",
        type: "badge",
        sortable: true,
        defaultVisibleInTable: true,
        tableOrder: 20,
        cardSlot: "meta",
        drawerSection: "role",
        drawerOrder: 20,
        accessor: (user) => user.role,
      },
      {
        key: "status",
        label: "Status",
        labelKey: "users.colStatus",
        type: "status",
        sortable: true,
        defaultVisibleInTable: true,
        tableOrder: 30,
        cardSlot: "meta",
        drawerSection: "basic",
        drawerOrder: 30,
        badgeVariantMap: userStatusBadgeMap,
      },
      {
        key: "lastLogin",
        label: "Last Login",
        labelKey: "users.colLastLogin",
        type: "date",
        sortable: true,
        defaultVisibleInTable: true,
        tableOrder: 40,
        cardSlot: "meta",
        drawerSection: "basic",
        drawerOrder: 40,
        accessor: (user) => user.lastLogin,
      },
      {
        key: "created",
        label: "Created",
        labelKey: "users.colCreated",
        type: "text",
        sortable: true,
        defaultVisibleInTable: true,
        tableOrder: 50,
        cardSlot: "meta",
        drawerSection: "basic",
        drawerOrder: 50,
        accessor: (user) => user.createdDate,
      },
      {
        key: "twoFactor",
        label: "Two-Factor",
        labelKey: "users.col2fa",
        type: "badge",
        sortable: false,
        defaultVisibleInTable: true,
        tableOrder: 60,
        cardSlot: "meta",
        drawerSection: "security",
        drawerOrder: 60,
        accessor: (user) => user.twoFactorEnabled,
        badgeVariantMap: twoFactorBadgeMap,
      },
    ],
  });
