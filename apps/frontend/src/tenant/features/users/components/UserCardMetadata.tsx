import type { SystemUser } from "@mms/shared";
import { DirectoryCardMetadata } from "@/components/app/DirectoryCardMetadata";
import { useTranslation } from "@/hooks/useTranslation";
import { renderUserWorkColumnValue } from "@/tenant/features/users/components/userWorkColumnCell";
import { useUsersEntityDescriptor } from "@/tenant/features/users/hooks/useUsersEntityDescriptor";

export interface UserCardMetadataProps {
  user: SystemUser;
  formatLoginDate: (timestamp: string) => string;
  isColumnVisible?: (key: string) => boolean;
}

/**
 * Users domain metadata tiles — Contacts card metadata chrome.
 *
 * Field identity, labels, visibility, and display order come from the SSOT
 * `usersEntityDescriptor` (i18n-resolved via `useUsersEntityDescriptor`).
 * Values stay with `renderUserWorkColumnValue` because role/status/2FA badge
 * labels require runtime translation and workspace roles.
 */
export function UserCardMetadata({
  user,
  formatLoginDate,
  isColumnVisible,
}: UserCardMetadataProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const descriptor = useUsersEntityDescriptor();
  const visible = isColumnVisible ?? (() => true);
  const metaColumns = descriptor.getCardFields().filter((field) => visible(field.key));

  return (
    <DirectoryCardMetadata
      columns={metaColumns}
      keyFor={(field) => field.key}
      labelFor={(field) => field.label}
      renderValue={(field) =>
        renderUserWorkColumnValue(user, field.key, {
          t,
          formatLoginDate,
        })
      }
    />
  );
}
