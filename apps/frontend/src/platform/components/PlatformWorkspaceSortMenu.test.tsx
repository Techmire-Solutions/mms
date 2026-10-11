import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlatformWorkspaceSortMenu } from './PlatformWorkspaceSortMenu';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'platform.sort.sortBy': 'Sort by',
        'platform.sort.name': 'Madrasa Name',
        'platform.sort.subdomain': 'Subdomain',
        'platform.sort.createdAt': 'Created At',
        'platform.sort.status': 'Status',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('PlatformWorkspaceSortMenu', () => {
  it('renders sort button trigger with Button primitive and label', () => {
    const handleToggleSort = vi.fn();
    const html = renderToStaticMarkup(
      <PlatformWorkspaceSortMenu
        sortField="name"
        sortDirection="asc"
        onToggleSort={handleToggleSort}
      />,
    );

    expect(html).toContain('Sort by');
    expect(html).toContain('type="button"');
  });
});
