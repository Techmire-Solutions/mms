import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AcademicCatalogItem } from '@mms/shared';
import { CatalogItemFormModal } from './CatalogItemFormModal';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const fiqh: AcademicCatalogItem = {
  id: 'sub-1', code: 'fiqh', name: 'Fiqh', shortName: null, status: 'active', sortOrder: 0, isSystem: true,
  deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

function setInputValue(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const saveButton = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('common.save'));

describe('CatalogItemFormModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onSave = vi.fn().mockResolvedValue(true);

  const render = (entry: AcademicCatalogItem | null, existing: AcademicCatalogItem[] = []) =>
    act(async () => {
      root.render(
        <CatalogItemFormModal open kind="subjects" entry={entry} existing={existing} isPending={false} onClose={onClose} onSave={onSave} />,
      );
    });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onClose.mockClear();
    onSave.mockClear();
    onSave.mockResolvedValue(true);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('given a new entry, should submit trimmed name and null blank optionals then close when saved', async () => {
    // Arrange
    await render(null);
    const nameInput = document.querySelector<HTMLInputElement>('#catalog-form-name')!;

    // Act
    await act(async () => {
      setInputValue(nameInput, '  Seerah  ');
    });
    await act(async () => {
      saveButton()?.click();
    });

    // Assert
    expect(onSave).toHaveBeenCalledWith({ name: 'Seerah', code: null, shortName: null, status: 'active' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('given a name matching another live entry case-insensitively, should block save and show the duplicate error', async () => {
    // Arrange
    await render(null, [fiqh]);
    const nameInput = document.querySelector<HTMLInputElement>('#catalog-form-name')!;

    // Act
    await act(async () => {
      setInputValue(nameInput, ' fIQh ');
    });
    await act(async () => {
      saveButton()?.click();
    });

    // Assert
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('academicCatalog.duplicateName');
    expect(nameInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('given a system entry, should lock its code while keeping the name editable', async () => {
    // Arrange / Act
    await render(fiqh, [fiqh]);

    // Assert
    const code = document.querySelector<HTMLInputElement>('#catalog-form-code')!;
    const name = document.querySelector<HTMLInputElement>('#catalog-form-name')!;
    expect(code).toBeInstanceOf(HTMLInputElement);
    expect(code.disabled).toBe(true);
    expect(name.value).toBe('Fiqh');
    expect(name.disabled).toBe(false);
  });
});
