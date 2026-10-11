import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkspacePasswordField } from './WorkspacePasswordField';
import { WorkspaceAdminDialogFooter } from './WorkspaceAdminDialogFooter';
import { CredentialsResultCard } from '@/components/ui/CredentialsResultCard';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/ui/CopyButton', () => ({
  CopyButton: ({ text, label }: { text: string; label: string }) => <button data-copy={text}>{label}</button>,
}));

function markup(node: React.ReactNode): HTMLDivElement {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

describe('workspace admin shared controls', () => {
  it('gives each password field a unique label target and associates its error', () => {
    const container = markup(<>
      <WorkspacePasswordField label="Initial password" placeholder="Generate" value="" onChange={vi.fn()} pending error="Too short" />
      <WorkspacePasswordField label="New password" placeholder="Generate" value="" onChange={vi.fn()} pending={false} />
    </>);
    const inputs = container.querySelectorAll('input');
    expect(inputs[0].id).not.toBe(inputs[1].id);
    expect(container.querySelector('label')?.htmlFor).toBe(inputs[0].id);
    expect(inputs[0].getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector(`[id="${inputs[0].getAttribute('aria-describedby')}"]`)?.textContent).toContain('Too short');
    expect(inputs[0].disabled).toBe(true);
    expect(inputs[1].disabled).toBe(false);
  });

  it('disables both actions while pending and shows only close after completion', () => {
    const props = { pending: true, confirmLabel: 'Create', onClose: vi.fn(), onConfirm: vi.fn() };
    const pending = markup(<WorkspaceAdminDialogFooter {...props} complete={false} />);
    expect(Array.from(pending.querySelectorAll('button')).every((button) => button.disabled)).toBe(true);
    const complete = markup(<WorkspaceAdminDialogFooter {...props} pending={false} complete />);
    expect(complete.querySelectorAll('button')).toHaveLength(1);
    expect(complete.textContent).toBe('common.close');
  });

  it('preserves caller-specific clipboard content and announces success without announcing credentials', () => {
    const container = markup(<CredentialsResultCard title="Created" fields={[{ label: 'Email', value: 'admin@example.com' }]}
      passwordLabel="Password" password="secret" copyText={"Email: admin@example.com\nPassword: secret"} copyLabel="Copy all" hint="Share privately" />);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Created');
    expect(container.querySelector('[data-copy]')?.getAttribute('data-copy')).toBe('Email: admin@example.com\nPassword: secret');
    expect(container.querySelector('code')?.textContent).toBe('secret');
  });
});
