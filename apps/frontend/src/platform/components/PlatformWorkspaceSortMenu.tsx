import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { WorkspaceSortDirection, WorkspaceSortField } from '@/platform/components/platformWorkspaceListData';
import { cn } from '@/lib/utils';

const SORT_MENU_ITEMS: { field: WorkspaceSortField; labelKey: 'platform.sort.name' | 'platform.sort.subdomain' | 'platform.sort.createdAt' | 'platform.sort.status' }[] = [
  { field: 'name', labelKey: 'platform.sort.name' },
  { field: 'subdomain', labelKey: 'platform.sort.subdomain' },
  { field: 'createdAt', labelKey: 'platform.sort.createdAt' },
  { field: 'status', labelKey: 'platform.sort.status' },
];

export interface PlatformWorkspaceSortMenuProps {
  sortField: WorkspaceSortField;
  sortDirection: WorkspaceSortDirection;
  onToggleSort: (field: WorkspaceSortField) => void;
}

/** Sort-by dropdown with active-column direction arrows. */
export function PlatformWorkspaceSortMenu({
  sortField,
  sortDirection,
  onToggleSort,
}: PlatformWorkspaceSortMenuProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          icon={ArrowUpDown}
          className="rounded-xl border-border/80 hover:bg-muted/80 select-none cursor-pointer"
        >
          {t('platform.sort.sortBy')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-xl shadow-md">
        {SORT_MENU_ITEMS.map((item) => {
          const isActive = sortField === item.field;
          return (
            <DropdownMenuItem
              key={item.field}
              onClick={() => onToggleSort(item.field)}
              className={cn(
                "text-xs font-semibold cursor-pointer flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors",
                isActive && "bg-primary/10 text-primary font-bold",
              )}
            >
              <span>{t(item.labelKey)}</span>
              {isActive ? (
                sortDirection === 'asc' ? (
                  <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                )
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}