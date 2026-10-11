import { apiFetch } from "@/lib/apiClient";
import { AUTH_PATHS } from "@/lib/apiClientHelpers";

/** Confirms the signed-in admin's password before encrypting or restoring a backup. */
export async function verifyAdminBackupPassword(
  email: string,
  password: string,
): Promise<
  | { ok: true }
  | {
      ok: false;
      errorKey:
        "backup.invalidAdminPassword" | "backup.serverForbidden" | "backup.serverFetchFailed";
    }
> {
  try {
    const response = await apiFetch(AUTH_PATHS.verifyPassword, {
      method: "POST",
      body: JSON.stringify({ password, email: email.trim().toLowerCase() }),
    });

    if (response.ok) {
      return { ok: true };
    }
    if (response.status === 401) {
      return { ok: false, errorKey: "backup.invalidAdminPassword" };
    }
    if (response.status === 403) {
      return { ok: false, errorKey: "backup.serverForbidden" };
    }
    return { ok: false, errorKey: "backup.serverFetchFailed" };
  } catch {
    return { ok: false, errorKey: "backup.serverFetchFailed" };
  }
}
