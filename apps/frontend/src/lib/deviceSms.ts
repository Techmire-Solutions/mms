import { buildDeviceSmsUri } from "@mms/shared";

/**
 * Opens the native SMS composer on supported devices (mobile browsers, some desktops).
 * Returns false when no valid phone or the environment blocks navigation.
 */
export function openDeviceSmsComposer(phone: string, body = ""): boolean {
  const uri = buildDeviceSmsUri(phone, body);
  if (!uri) return false;

  const anchor = document.createElement("a");
  anchor.href = uri;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
