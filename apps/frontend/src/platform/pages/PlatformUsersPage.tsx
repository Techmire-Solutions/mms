import React, { useMemo } from 'react';
import { Users, BarChart3, Settings, Download, Activity } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { ModulePageShell } from '@/components/ui/ModulePageShell';
import { Button } from '@/components/ui/button';
import { PlatformAddAdminForm } from '@/platform/pages/PlatformAddAdminForm';
import { usePlatformAdmins } from '@/platform/hooks/usePlatformAdmins';
import { usePlatformPermissions } from '@/platform/hooks/usePlatformPermissions';
import { usePlatformUserDescriptor } from '@/platform/hooks/usePlatformUserDescriptor';
import { exportPlatformAdminsCsv } from '@/platform/components/admin/exportPlatformAdminsCsv';
import { PlatformUsersCommandMetrics } from '@/platform/components/users/PlatformUsersCommandMetrics';
import { PlatformUsersTier, type PlatformUsersSubTab } from '@/platform/components/tiers/PlatformUsersTier';
import type { AccordionTabItem } from '@/components/ui/ResponsiveAccordionTabs';
import { ROUTES } from '@/lib/config/routes';

export type PlatformUsersTab = PlatformUsersSubTab;

export default function PlatformUsersPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { canAdmins, canSystem, canSettings } = usePlatformPermissions();
  const { data: admins, isLoading, isError } = usePlatformAdmins();
  const descriptor = usePlatformUserDescriptor();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab') as PlatformUsersTab | null;
  const activeTab: PlatformUsersTab =
    rawTab === 'reports' || rawTab === 'setup' || rawTab === 'work' ? rawTab : 'work';

  const handleTabChange = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      next.delete('subtab');
      return next;
    });
  };

  const tabs: AccordionTabItem[] = useMemo(
    () => [
      {
        id: 'work',
        label: t('module.work'),
        description: t('module.workHint'),
        icon: Users,
      },
      {
        id: 'reports',
        label: t('module.reports'),
        description: t('module.reportsHint'),
        icon: BarChart3,
      },
      {
        id: 'setup',
        label: t('module.setup'),
        description: t('module.setupHint'),
        icon: Settings,
      },
    ],
    [t],
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      {canSystem ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-11 gap-1.5 cursor-pointer"
          title={t('platform.viewActivityLogs')}
        >
          <Link to={ROUTES.platformActivityLogs}>
            <Activity className="h-4 w-4" aria-hidden />
            {t('platform.viewActivityLogs')}
          </Link>
        </Button>
      ) : null}
      {activeTab === 'setup' && canSettings ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="min-h-11 gap-1.5 cursor-pointer"
          title={t('platform.settingsTabSecurity')}
        >
          <Link to={`${ROUTES.platformSettings}?section=security`}>
            <Settings className="h-4 w-4" aria-hidden />
            {t('platform.settingsTabSecurity')}
          </Link>
        </Button>
      ) : null}
      {activeTab === 'work' && admins && admins.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          icon={Download}
          onClick={() => exportPlatformAdminsCsv(admins, descriptor)}
          title={t('users.exportCsv')}
        >
          {t('users.exportCsv')}
        </Button>
      ) : null}
      {canAdmins ? <PlatformAddAdminForm asTriggerOnly /> : null}
    </div>
  );

  return (
    <ModulePageShell
      seoTitle={`${t('nav.users')} | ${t('platform.consoleTitle')}`}
      seoDescription={t('platform.adminsSubtitle')}
      headerIcon={Users}
      headerTitle={t('nav.users')}
      headerSubtitle={t('platform.adminsSubtitle')}
      headerActions={headerActions}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      panelIdPrefix="platform-users-tab"
      metricsStrip={
        <PlatformUsersCommandMetrics admins={admins} loading={isLoading} error={isError} />
      }
    >
      <PlatformUsersTier activeSubTab={activeTab} showSubTabBar={false} />
    </ModulePageShell>
  );
}
