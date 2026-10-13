import React, { type ReactNode } from "react";
import {
  FormCollectionShell,
  type FormCollectionShellProps,
} from "@/components/app/FormPrimitives";

/** True when any Setup field for the sub-list is enabled or custom fields exist. */
export function resolveSubListAllowAdd(
  enabledFieldFlags: boolean[],
  customFieldsLength: number = 0,
): boolean {
  return enabledFieldFlags.some(Boolean) || customFieldsLength > 0;
}

/** True when the item is explicitly primary or the default first item in a non-empty list. */
export function isSubListItemPrimary<T extends { isPrimary?: boolean }>(
  items: readonly T[],
  item: { isPrimary?: boolean } | Record<string, unknown>,
  index: number,
): boolean {
  if (items.length <= 1) return true;
  const hasExplicitPrimary = items.some((i) => i.isPrimary);
  return Boolean(item.isPrimary || (!hasExplicitPrimary && index === 0));
}

export type ContactSubListShellProps = Omit<FormCollectionShellProps, "title" | "icon"> & {
  isEmpty: boolean;
  emptyIcon: React.ComponentType<{ className?: string }>;
  emptyMessage: string;
  onEnsureRow: () => void;
  children: ReactNode;
};

/** Contact adapter over FormCollectionShell (empty-state + ensure-row + add). */
export function ContactSubListShell(props: ContactSubListShellProps): React.JSX.Element {
  return <FormCollectionShell {...props} />;
}
