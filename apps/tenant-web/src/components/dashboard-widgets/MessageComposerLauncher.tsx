import {
  TenantMessageComposerLauncher,
  type TenantMessageComposerLauncherProps,
} from "@/tenant/components/messaging/TenantMessageComposerLauncher";

/**
 * Renders the shared `MessageComposer` dialog when a messaging target is
 * active, otherwise nothing. Deduplicates the trailing composer block used
 * by the outstanding-fees and overdue-obligations widgets.
 */
export const MessageComposerLauncher = TenantMessageComposerLauncher;
export type MessageComposerLauncherProps = TenantMessageComposerLauncherProps;
export default MessageComposerLauncher;
