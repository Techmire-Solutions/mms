import React from 'react';
import { Check, X } from 'lucide-react';
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type RbacModuleDef,
} from '@mms/shared';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { FormCheckboxCard } from '@/components/ui/FormCheckboxCard';
import { WORK_SURFACE_INNER } from '@/components/ui/formStyles';
import type { PermissionMatrixActions } from '@/tenant/features/users/components/PermissionMatrixRow';

type PermissionMatrixMobileRowProps = PermissionMatrixActions & {
  mod: RbacModuleDef;
};

export function PermissionMatrixMobileRow({
  mod,
  perms,
  readOnly,
  onToggle,
  onSelectAll,
  onClearAll,
}: PermissionMatrixMobileRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const currentActions = perms[mod.id] || [];
  const allChecked = PERMISSION_ACTIONS.every((permissionAction) => currentActions.includes(permissionAction));
  const hasAny = currentActions.length > 0;

  return (
    <article className={`${WORK_SURFACE_INNER} space-y-3 p-3 transition-opacity ${hasAny || !readOnly ? '' : 'opacity-40'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="min-w-0 text-sm font-semibold text-foreground truncate">{t(mod.labelKey)}</h4>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-semibold ${
              allChecked
                ? 'bg-primary/15 text-primary'
                : hasAny
                  ? 'bg-muted/80 text-foreground'
                  : 'bg-muted/40 text-muted-foreground'
            }`}
          >
            {currentActions.length}/{PERMISSION_ACTIONS.length}
          </span>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (allChecked ? onClearAll(mod.id) : onSelectAll(mod.id))}
            aria-label={`${t('users.permissions.colAll')}: ${t(mod.labelKey)}`}
            className="px-2.5 text-xs font-semibold gap-1 shrink-0 rounded-lg cursor-pointer"
          >
            {allChecked ? <X className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
            <span>{allChecked ? t('common.deselect') : t('users.permissions.colAll')}</span>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PERMISSION_ACTIONS.map((permissionAction: PermissionAction) => {
          const isActive = currentActions.includes(permissionAction);
          return (
            <FormCheckboxCard
              key={permissionAction}
              id={`perm-${mod.id}-${permissionAction}`}
              checked={isActive}
              disabled={readOnly}
              onCheckedChange={() => !readOnly && onToggle(mod.id, permissionAction)}
              label={t(`users.permission.${permissionAction}`)}
              className="pt-0"
            />
          );
        })}
      </div>
    </article>
  );
}
