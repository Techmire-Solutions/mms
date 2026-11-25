import React from "react";
import { useFacultyHost } from "../host.js";
export { invalidateUsersQueries } from "./usersInvalidation.js";

export function useUsersContractList(...args: any[]) {
  return useFacultyHost().users.useUsersContractList(...args);
}
export function useCreateWorkspaceRole(...args: any[]) {
  return useFacultyHost().users.useCreateWorkspaceRole(...args);
}
export function RoleFormModal(props: any): React.JSX.Element {
  const C = useFacultyHost().users.RoleFormModal;
  return <C {...props} />;
}
