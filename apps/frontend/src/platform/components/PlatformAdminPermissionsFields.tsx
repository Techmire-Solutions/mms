import React from 'react';
import { Shield, Sparkles, CheckCheck, XCircle } from 'lucide-react';
import { DEFAULT_PLATFORM_ADMIN_PERMISSIONS, FULL_PLATFORM_ADMIN_PERMISSIONS, type PlatformAdminPermissions } from '@mms/shared';
import { PLATFORM_PERMISSION_CONFIG } from '@/platform/lib/platformPermissionConfig';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { PlatformPermissionCheckboxItem } from '@/platform/components/admin/PlatformPermissionCheckboxItem';

interface PlatformAdminPermissionsFieldsProps {
  value: PlatformAdminPermissions;
  onChange: (next: PlatformAdminPermissions) => void;
  disabled?: boolean;
}

/** Modern grantable-permission checkboxes with capability badges, archetype presets, and accessibility helpers. */
export function PlatformAdminPermissionsFields({
  value,
  onChange,
  disabled = false,
}: PlatformAdminPermissionsFieldsProps): React.JSX.Element {
  const { t } = useTranslation();

  const setAll = (enabled: boolean) => {
    onChange({ ...(enabled ? FULL_PLATFORM_ADMIN_PERMISSIONS : DEFAULT_PLATFORM_ADMIN_PERMISSIONS) });
  };

  const setOperations = () => {
    onChange({
      ...DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
      workspaces: true,
      onboard: true,
    });
  };

  return (
    <fieldset className="space-y-4 rounded-2xl border border-border/50 bg-card/40 p-4 transition-all">
      <legend className="px-1 text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-primary" aria-hidden />
        {t('platform.adminPermissionsLabel')}
      </legend>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={CheckCheck}
            disabled={disabled}
            onClick={() => setAll(true)}
          >
            {t('common.selectAll')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Sparkles}
            disabled={disabled}
            onClick={setOperations}
          >
            {t('platform.permWorkspaces')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={XCircle}
            disabled={disabled}
            onClick={() => setAll(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            {t('common.deselect')}
          </Button>
        </div>
      </div>

      {PLATFORM_PERMISSION_CONFIG.map(({ key, name, labelKey, descriptionKey, icon }) => (
        <PlatformPermissionCheckboxItem
          key={key}
          name={name}
          label={t(labelKey)}
          description={t(descriptionKey)}
          icon={icon}
          checked={value[key]}
          disabled={disabled}
          onChange={(checked) => onChange({ ...value, [key]: checked })}
        />
      ))}
    </fieldset>
  );
}
