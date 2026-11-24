import * as React from "react";
import {
  UserAvatar as BaseUserAvatar,
  type UserAvatarProps as BaseUserAvatarProps,
  USER_STATUS_COLORS,
  getInitials,
} from "@mms/ui";
import { getGenderAvatarFallbackClass } from "./genderUi";

export const STATUS_COLORS = USER_STATUS_COLORS;
export { getInitials };
export type UserAvatarProps = BaseUserAvatarProps;

/**
 * Backward-compatible UserAvatar facade re-exporting from @mms/ui,
 * providing the tenant console's gender/palette fallback resolver by default.
 */
export const UserAvatar = function UserAvatar(props: UserAvatarProps): React.JSX.Element {
  return (
    <BaseUserAvatar
      fallbackColorResolver={props.fallbackColorResolver ?? getGenderAvatarFallbackClass}
      {...props}
    />
  );
};
