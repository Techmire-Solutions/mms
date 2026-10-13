import React, { type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkCardAction, type UseWorkCardActionReturn } from "@/hooks/useWorkCardAction";
import { EntityCard } from "@/components/app/EntityCard";
import {
  EntityCardInfoPills,
  type EntityCardInfoPillsProps,
} from "@/components/app/EntityCardInfoPills";
import { EntityCardMetadata } from "@/components/app/EntityCardMetadata";
import { EntityCardFooterActions } from "@/components/app/EntityCardFooterActions";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";

export interface DirectoryCardHeaderConfig {
  displayName: string;
  avatar?: string | null;
  gender?: string | null;
  subtitle?: ReactNode;
  showSelect?: boolean;
}

export interface DirectoryCardProps<
  TEntity extends { id: string | number },
  TColumn extends { label: string } = { label: string },
> {
  entity: TEntity;
  /** Config for standard EntityCard.Header. Optional if headerSlot is provided. */
  header?: DirectoryCardHeaderConfig;
  /** Custom header component replacement. */
  headerSlot?: ReactNode;
  selectedIds?: (string | number)[];
  canSelect?: boolean;
  onToggleSelected?: (id: TEntity["id"], checked: boolean) => void;
  onView?: (entity: TEntity) => void;
  onEdit?: (entity: TEntity) => void;
  accentClassName?: string | false | null;
  className?: string;
  reducedMotion?: boolean;
  actionState?: UseWorkCardActionReturn<TEntity>;

  /** Optional contact action pills (phones, emails, WhatsApp/SMS triggers). */
  infoPills?: Omit<EntityCardInfoPillsProps, "displayName">;

  /** Declarative entity descriptor for SSOT metadata tile rendering. */
  descriptor?: EntityDescriptor<TEntity>;
  /** Predicate to filter visible metadata fields. */
  isColumnVisible?: (key: string) => boolean;

  /** Optional legacy/custom column metadata definition. */
  columns?: TColumn[];
  keyFor?: (col: TColumn) => string;
  labelFor?: (col: TColumn) => string;
  renderValue?: (col: TColumn) => ReactNode | null;

  /** Optional archive or status banner. */
  banner?: ReactNode;
  /** Custom metadata slot when EntityCardMetadata cannot be used. */
  metadataSlot?: ReactNode;
  /** Custom additional body content. */
  children?: ReactNode;

  /** Fully custom footer replacement. When omitted, standard EntityCardFooterActions is rendered. */
  footer?: ReactNode;
  /** Label for primary view button (defaults to localized "View"). */
  viewLabel?: string;
  /** Aria label for primary view button. */
  viewAriaLabel?: string;
  /** Optional leading element in footer (e.g. messaging status). */
  footerLeading?: ReactNode;
  /** Optional action buttons placed before overflowActions. */
  actions?: ReactNode;
  /** Overflow action menu or secondary buttons. */
  overflowActions?: ReactNode;
  /** Optional card-body click (e.g. examinations/question-bank row open). */
  onCardClick?: () => void;
}

/**
 * Unified Work-directory entity card component.
 *
 * Combines useWorkCardAction, EntityCard, EntityCard.Header,
 * EntityCardMetadata, and EntityCardFooterActions into a declarative,
 * accessible, and token-consistent primitive.
 */
export function DirectoryCard<
  TEntity extends { id: string | number },
  TColumn extends { label: string } = { label: string },
>({
  entity,
  header,
  headerSlot,
  selectedIds = [],
  canSelect = false,
  onToggleSelected,
  onView,
  onEdit,
  accentClassName,
  className,
  reducedMotion,
  actionState,
  infoPills,
  descriptor,
  isColumnVisible,
  columns,
  keyFor,
  labelFor,
  renderValue,
  banner,
  metadataSlot,
  children,
  footer,
  viewLabel,
  viewAriaLabel,
  footerLeading,
  actions,
  overflowActions,
  onCardClick,
}: DirectoryCardProps<TEntity, TColumn>): React.JSX.Element {
  const { t } = useTranslation();
  const systemReducedMotion = useReducedMotion();
  const effectiveReducedMotion = reducedMotion ?? systemReducedMotion;

  const defaultActionState = useWorkCardAction({
    entity,
    selectedIds,
    onToggleSelected,
    onView,
    onEdit,
    canSelect,
  });

  const action = actionState ?? defaultActionState;
  const defaultViewLabel = viewLabel ?? t("contacts.actionViewShort");
  const displayName = header?.displayName ?? "";
  const effectiveViewAriaLabel = viewAriaLabel ?? `${defaultViewLabel} - ${displayName}`;

  return (
    <EntityCard
      isSelected={action.isSelected}
      reducedMotion={effectiveReducedMotion}
      accentClassName={accentClassName}
      className={className}
      {...action.cardProps}
      onClick={onCardClick}
    >
      {headerSlot ??
        (header ? (
          <EntityCard.Header
            id={entity.id}
            displayName={header.displayName}
            avatar={header.avatar}
            gender={header.gender}
            isSelected={action.isSelected}
            showSelect={header.showSelect ?? canSelect}
            onSelect={action.onSelect}
            selectAriaLabel={header.displayName}
            onView={onView ? action.onView : undefined}
            viewAriaLabel={effectiveViewAriaLabel}
            subtitle={header.subtitle}
            reducedMotion={effectiveReducedMotion}
          />
        ) : null)}

      {infoPills ? <EntityCardInfoPills displayName={displayName} {...infoPills} /> : null}

      {metadataSlot ??
        (descriptor || columns ? (
          <EntityCardMetadata
            descriptor={descriptor}
            entity={entity}
            isColumnVisible={isColumnVisible}
            columns={columns}
            keyFor={keyFor}
            labelFor={labelFor}
            renderValue={renderValue}
          />
        ) : null)}

      {banner}
      {children}

      {footer ?? (
        <EntityCardFooterActions
          onView={onView ? action.onView : undefined}
          viewLabel={viewLabel}
          viewAriaLabel={effectiveViewAriaLabel}
          leading={footerLeading}
          actions={actions}
          overflowActions={overflowActions}
        />
      )}
    </EntityCard>
  );
}
