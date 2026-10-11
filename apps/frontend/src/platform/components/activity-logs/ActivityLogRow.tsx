import React from 'react';
import { User, Calendar, Code2 } from 'lucide-react';
import { formatDate } from '@mms/shared';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getActionMeta } from './activityLogMeta';
import type { PlatformActivityLogItem } from '@/platform/hooks/usePlatformActivityLogs';

interface ActivityLogRowProps {
  log: PlatformActivityLogItem;
  onInspect: (log: PlatformActivityLogItem) => void;
}

export function ActivityLogRow({ log, onInspect }: ActivityLogRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const { tone, Icon } = getActionMeta(log.action);
  const formattedDate = formatDate(log.createdAt);
  const hasMetadata = Boolean(log.metadataMessage || log.targetResource || log.targetId);

  return (
    <div className="relative group">
      {/* Timeline Node Icon */}
      <div className="absolute -start-9 top-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-xs">
        <Icon className="w-3.5 h-3.5 text-foreground" aria-hidden />
      </div>

      <div className="flex flex-col gap-2 p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card hover:border-border transition-all shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={tone} pill size="md" className="uppercase tracking-wider font-bold">
              {log.action.replace(/_/g, ' ')}
            </Badge>

            {log.targetResource && (
              <Badge tone="muted" size="sm" className="font-medium">
                {log.targetResource}{log.targetId ? `: ${log.targetId}` : ''}
              </Badge>
            )}

            <span className="text-xs font-bold text-foreground flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
              {log.userEmail}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
            {log.ipAddress && (
              <span className="font-mono bg-muted/60 border border-border/40 px-2 py-0.5 rounded text-3xs font-semibold">
                {log.ipAddress}
              </span>
            )}

            <span className="flex items-center gap-1 font-medium text-3xs">
              <Calendar className="w-3 h-3 text-muted-foreground" aria-hidden />
              {formattedDate}
            </span>

            <Button
              variant="ghost"
              size="sm"
              icon={Code2}
              onClick={() => onInspect(log)}
              className="min-w-11 text-muted-foreground hover:text-foreground"
              title={t('platform.logs.inspectJson')}
              aria-label={t('platform.logs.inspectJson')}
            />
          </div>
        </div>

        {hasMetadata && log.metadataMessage && (
          <div className="pt-1">
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 border border-border/30 font-mono">
              {log.metadataMessage}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
