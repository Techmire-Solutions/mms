export const REMEMBER_EMAIL_KEY = "mms_login_remember_email";

export function readRememberedLoginEmail(): string {
  try {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readRememberMeEnabled(): boolean {
  try {
    return Boolean(localStorage.getItem(REMEMBER_EMAIL_KEY));
  } catch {
    return false;
  }
}

export function persistRememberedLoginEmail(value: string, remember: boolean): void {
  try {
    if (remember && value.trim()) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, value.trim());
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
  } catch {
    // ignore storage failures
  }
}
