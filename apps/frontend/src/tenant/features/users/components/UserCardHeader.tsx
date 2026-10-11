import type { SystemUser } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { EntityCard } from "@/components/ui/EntityCard";

export interface UserCardHeaderProps {
  user: SystemUser;
  isSelected: boolean;
  showSelect: boolean;
  onToggleSelect: (id: string) => void;
  onView: (user: SystemUser) => void;
  isColumnVisible?: (key: string) => boolean;
  reducedMotion?: boolean;
}

/** Contacts-shaped horizontal card header: checkbox | avatar + name + email. */
export function UserCardHeader({
  user,
  isSelected,
  showSelect,
  onToggleSelect,
  onView,
  isColumnVisible,
  reducedMotion = false,
}: UserCardHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const showEmail = !isColumnVisible || isColumnVisible("email");
  const displayName = user.name?.trim() || user.email || "";

  return (
    <EntityCard.Header
      id={user.id}
      displayName={displayName}
      isSelected={isSelected}
      showSelect={showSelect}
      onSelect={() => onToggleSelect(user.id)}
      selectAriaLabel={t("users.selectRow", { name: displayName })}
      onView={() => onView(user)}
      viewAriaLabel={t("users.actionView", { name: displayName })}
      reducedMotion={reducedMotion}
      subtitle={
        showEmail && user.email ? (
          <p
            className="mt-0.5 text-xs font-semibold text-muted-foreground truncate"
            title={user.email}
          >
            {user.email}
          </p>
        ) : undefined
      }
    />
  );
}
