import React from 'react';
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from '@mms/shared';
import WorkspaceLogo from '@/platform/components/WorkspaceLogo';
import { tenantUrl } from '@/lib/config/tenantConfig';
import { CopyButton } from '@/components/ui/CopyButton';
import { ExternalLink, Mail } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface WorkspaceIdentityCellProps {
  workspace: PlatformWorkspaceRowData;
  appDomain: string;
}

export function WorkspaceIdentityCell({
  workspace,
  appDomain,
}: WorkspaceIdentityCellProps): React.JSX.Element {
  const { t } = useTranslation();
  const tenantLink = tenantUrl(workspace.subdomain, '/');
  const openTitle = `${t('platform.openWorkspace')} (${workspace.subdomain}.${appDomain})`;

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105">
        <WorkspaceLogo
          logoUrl={workspace.logoUrl}
          madrasaName={workspace.madrasaName}
          className="rounded-xl border border-border/40 shadow-2xs"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold tracking-tight text-foreground truncate group-hover:text-primary transition-colors text-balance">
            {workspace.madrasaName}
          </h3>
          <a
            href={tenantLink}
            target="_blank"
            rel="noopener noreferrer"
            title={openTitle}
            className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg hover:bg-primary/10 shrink-0 cursor-pointer"
            aria-label={openTitle}
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          </a>
        </div>
        {workspace.tagline ? (
          <p className="text-xs font-medium text-muted-foreground truncate">
            {workspace.tagline}
          </p>
        ) : null}
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <div
            dir="ltr"
            className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 border border-border/50 font-mono text-2xs"
          >
            <span className="font-bold text-primary">{workspace.subdomain}</span>
            <span className="text-muted-foreground">.{appDomain}</span>
          </div>
          <CopyButton
            text={tenantLink}
            className="min-h-11 min-w-11 p-0 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity rounded-md cursor-pointer"
            showToast
          />
        </div>
        {workspace.adminEmail ? (
          <div className="text-2xs font-semibold text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3 text-primary/70 shrink-0" aria-hidden />
            <span className="truncate" title={`Admin: ${workspace.adminEmail}`}>{workspace.adminEmail}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
