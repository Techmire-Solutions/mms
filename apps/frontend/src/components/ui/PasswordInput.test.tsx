import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordInput } from './PasswordInput';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('PasswordInput shared visibility control', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('toggles visibility and accessible state without submitting the form', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await act(async () => root.render(<form onSubmit={submit}>
      <PasswordInput id="password" label="Password" defaultValue="Example1!" />
    </form>));
    const input = container.querySelector('input');
    const button = container.querySelector('button');
    expect(container.querySelector('label')?.htmlFor).toBe(input?.id);
    expect(input?.type).toBe('password');
    expect(button?.getAttribute('aria-label')).toBe('auth.showPassword');
    await act(async () => button?.click());
    expect(input?.type).toBe('text');
    expect(input?.value).toBe('Example1!');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.getAttribute('aria-label')).toBe('auth.hidePassword');
    await act(async () => button?.click());
    expect(input?.type).toBe('password');
    expect(submit).not.toHaveBeenCalled();
  });

  it('disables visibility changes with the field', async () => {
    await act(async () => root.render(<PasswordInput id="disabled-password" disabled />));
    expect(container.querySelector('button')?.disabled).toBe(true);
    await act(async () => container.querySelector('button')?.click());
    expect(container.querySelector('input')?.type).toBe('password');
  });
});
