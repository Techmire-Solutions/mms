import type { AppTranslationKey } from "../i18n/appTranslations.js";
import type { ActivityAction, UserBadgeVariant } from "./userEntityTypes.js";

export const ACTIVITY_ACTIONS: readonly ActivityAction[] = [
  "login",
  "login_failed",
  "create",
  "update",
  "delete",
  "role_change",
] as const;

export const ACTIVITY_ACTION_REGISTRY: readonly {
  id: ActivityAction;
  labelKey: AppTranslationKey;
  badgeVariant: UserBadgeVariant;
}[] = [
  { id: "login", labelKey: "users.action.login", badgeVariant: "success" },
  { id: "login_failed", labelKey: "users.action.loginFailed", badgeVariant: "destructive" },
  { id: "create", labelKey: "users.action.create", badgeVariant: "primary" },
  { id: "update", labelKey: "users.action.update", badgeVariant: "warning" },
  { id: "delete", labelKey: "users.action.delete", badgeVariant: "destructive" },
  { id: "role_change", labelKey: "users.action.roleChange", badgeVariant: "primary" },
] as const;

export const ACTIVITY_ACTION_MAP: Readonly<
  Record<ActivityAction, (typeof ACTIVITY_ACTION_REGISTRY)[number]>
> = Object.freeze(
  Object.fromEntries(ACTIVITY_ACTION_REGISTRY.map((action) => [action.id, action])) as Record<
    ActivityAction,
    (typeof ACTIVITY_ACTION_REGISTRY)[number]
  >,
);

export function isValidActivityAction(action: unknown): action is ActivityAction {
  return (
    typeof action === "string" && Object.prototype.hasOwnProperty.call(ACTIVITY_ACTION_MAP, action)
  );
}
