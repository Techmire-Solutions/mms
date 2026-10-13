import React, { type ElementType, type ReactNode, useEffect, useRef } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormAddAnotherButton } from "@/components/ui/FormAddAnotherButton";
import { COLLECTION_BODY } from "@/components/ui/formPrimitiveStyles";
import { cn } from "@/lib/utils";

export interface FormCollectionShellProps {
  /** Plain collection heading — omit when a FormModal tab already names the area. */
  title?: ReactNode;
  icon?: ElementType;
  isEmpty?: boolean;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyMessage?: string;
  addLabel: string;
  onAdd: () => void;
  /** Idempotent seed when the list is empty (zero-click first row). */
  onEnsureRow?: () => void;
  /** When false, hide add/ensure (e.g. Setup fields disabled). */
  allowAdd?: boolean;
  addDisabled?: boolean;
  /** Stable key so ensure-row re-runs if the collection identity changes. */
  listKey?: string;
  className?: string;
  children: ReactNode;
}

/**
 * SSOT chrome for repeatable form collections: optional plain heading,
 * empty state, row list body, and FormAddAnotherButton.
 * Never wraps rows in SectionCard — rows use FormListFieldCard.
 */
export function FormCollectionShell({
  title,
  icon: Icon,
  isEmpty = false,
  emptyIcon,
  emptyMessage,
  addLabel,
  onAdd,
  onEnsureRow,
  allowAdd = true,
  addDisabled = false,
  listKey = "default",
  className,
  children,
}: FormCollectionShellProps): React.JSX.Element {
  const initializedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!allowAdd || !isEmpty || !onEnsureRow) return;
    if (initializedRef.current[listKey]) return;
    initializedRef.current[listKey] = true;
    onEnsureRow();
  }, [allowAdd, isEmpty, onEnsureRow, listKey]);

  return (
    <div className={cn("space-y-3 text-start", className)}>
      {title ? (
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="size-4 text-primary" aria-hidden /> : null}
          {typeof title === "string" || typeof title === "number" ? (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          ) : (
            title
          )}
        </div>
      ) : null}

      {isEmpty && emptyMessage ? (
        emptyIcon ? (
          <EmptyState variant="dashed" icon={emptyIcon} title={emptyMessage} compact />
        ) : (
          <p className="text-xs text-muted-foreground italic border border-dashed rounded-lg p-3 text-center">
            {emptyMessage}
          </p>
        )
      ) : null}

      <div className={COLLECTION_BODY}>{children}</div>

      {allowAdd ? (
        <FormAddAnotherButton label={addLabel} onClick={onAdd} disabled={addDisabled} />
      ) : null}
    </div>
  );
}
