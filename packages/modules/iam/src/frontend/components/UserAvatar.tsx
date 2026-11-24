import React from "react";
import { UserAvatar as UiUserAvatar, type UserAvatarProps } from "@mms/ui";

export type IamUserAvatarProps = UserAvatarProps;

/** IAM alias of the shared avatar primitive (keeps IAM imports audience-clean). */
export function UserAvatar(props: IamUserAvatarProps): React.JSX.Element {
  return <UiUserAvatar {...props} />;
}
