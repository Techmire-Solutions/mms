export {
  createWorkspaceUserSchema,
  inviteWorkspaceUserSchema,
  userStatusSchema,
  workspaceUserRecordSchema,
} from "@mms/contracts";

export type IamInviteStatus = "pending" | "active" | "expired";

/**
 * Derives a display-only invitation state from existing user fields. No schema
 * addition: a user who has never signed in and still must change the password is
 * pending; an unknown stale invitation is shown as expired.
 */
export function inviteStatus(input: {
  emailVerifiedAt?: string | null;
  mustChangePassword?: boolean;
  lastLogin?: string;
  createdAt?: string;
  now?: Date;
}): IamInviteStatus {
  if (input.lastLogin && input.lastLogin.trim().length > 0) return "active";
  if (input.emailVerifiedAt) return "active";
  if (input.createdAt) {
    const created = Date.parse(input.createdAt);
    if (Number.isFinite(created)) {
      const ageMs = (input.now ?? new Date()).getTime() - created;
      if (ageMs > 30 * 24 * 60 * 60 * 1000) return "expired";
    }
  }
  return "pending";
}
