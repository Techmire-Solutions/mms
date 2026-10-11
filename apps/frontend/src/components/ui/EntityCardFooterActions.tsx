import React, { type ReactNode } from "react";
import { EntityCardViewButton } from "@/components/ui/EntityCardViewButton";
import { useTranslation } from "@/hooks/useTranslation";
import { EntityCard } from "@/components/ui/EntityCard";

export interface EntityCardFooterActionsProps {
  /** Optional view callback; when present, renders standard EntityCardViewButton. */
  onView?: () => void;
  /** Optional label for view button; defaults to t("contacts.actionViewShort"). */
  viewLabel?: string;
  /** Accessible aria-label for view button. */
  viewAriaLabel?: string;
  /** Optional leading element (e.g. messaging pills, status chip). */
  leading?: ReactNode;
  /** Optional intermediate action buttons placed before overflowActions (e.g. Print button). */
  actions?: ReactNode;
  /** Optional overflow menu actions (e.g. domain row actions). */
  overflowActions?: ReactNode;
  /** Additional trailing action buttons or custom items. */
  children?: ReactNode;
}

/**
 * Standardized Work-directory card footer actions.
 * Enforces uniform View button + overflow menu trigger layout with WCAG 44px touch targets.
 */
export const EntityCardFooterActions = React.memo(function EntityCardFooterActions({
  onView,
  viewLabel,
  viewAriaLabel,
  leading,
  actions,
  overflowActions,
  children,
}: EntityCardFooterActionsProps): React.JSX.Element {
  const { t } = useTranslation();
  const label = viewLabel ?? t("contacts.actionViewShort");

  return (
    <EntityCard.Footer
      leading={leading}
      trailing={
        <>
          {onView ? (
            <EntityCardViewButton
              label={label}
              ariaLabel={viewAriaLabel ?? label}
              onClick={onView}
            />
          ) : null}
          {actions}
          {overflowActions}
          {children}
        </>
      }
    />
  );
});
