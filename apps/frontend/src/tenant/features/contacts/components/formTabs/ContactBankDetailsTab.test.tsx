import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactBankDetailsTab } from "./ContactBankDetailsTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.index !== undefined) {
        return `${key}:${params.index}`;
      }
      return key;
    },
  }),
}));

vi.mock("./ContactSubListCards", () => ({
  ContactSubListShell: ({
    children,
    isEmpty,
    emptyMessage,
  }: {
    children: React.ReactNode;
    isEmpty?: boolean;
    emptyMessage?: React.ReactNode;
  }) => (
    <div data-testid="sublist-shell">
      {isEmpty ? <div data-testid="empty-message">{emptyMessage}</div> : children}
    </div>
  ),
  FormListFieldCard: ({
    label,
    typeSelect,
    children,
  }: {
    label?: string;
    typeSelect?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="list-field-card">
      {label && <div data-testid="card-label">{label}</div>}
      {typeSelect ? <div data-testid="card-type-select">{typeSelect}</div> : null}
      <div data-testid="card-body">{children}</div>
    </div>
  ),
  resolveSubListAllowAdd: () => true,
}));

vi.mock("@/components/app/FormPrimitives", () => ({
  TYPE_SELECT_WIDTH: "w-32",
  FormCardTypeSelect: ({
    label,
    children,
  }: {
    label: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <span>{label}</span>
      {children}
    </div>
  ),
  FieldErrorMessage: ({ message }: { message?: string }) =>
    message ? <span data-testid="field-error">{message}</span> : null,
  Field: ({
    label,
    error,
    children,
  }: {
    label: string;
    error?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="field">
      <label>{label}</label>
      {error && <span data-testid="field-error">{error}</span>}
      {children}
    </div>
  ),
  EditableSelect: ({ value }: { value?: string }) => (
    <div data-testid="editable-select">{value}</div>
  ),
  FormListFieldCard: ({
    label,
    typeSelect,
    removeLabel,
    children,
  }: {
    label?: string;
    typeSelect?: React.ReactNode;
    removeLabel?: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="list-field-card">
      {label && <div data-testid="card-label">{label}</div>}
      {typeSelect ? <div data-testid="card-type-select">{typeSelect}</div> : null}
      <div data-testid="card-body">{children}</div>
      {removeLabel && <div data-testid="card-remove-label">{removeLabel}</div>}
    </div>
  ),
}));

vi.mock("@/components/app/LeadingIconInput", () => ({
  LeadingIconInput: ({
    value,
    placeholder,
    className,
  }: {
    value?: string;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="leading-icon-input"
      value={value || ""}
      placeholder={placeholder}
      className={className}
      readOnly
    />
  ),
}));

describe("ContactBankDetailsTab Component", () => {
  const baseProps = {
    formInstanceId: "test-form",
    getLocalId: (_g: string, idx: number) => `local-bank-${idx}`,
    getListItemError: () => undefined,
    isFieldEnabled: () => true,
    isFieldRequired: () => false,
    fields: {},
    addSubListItem: vi.fn(),
    ensureSubListItem: vi.fn(),
    updateSubListItem: vi.fn(),
    removeSubListItem: vi.fn(),
  };

  it("renders empty state when no bank accounts exist", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailsTab {...baseProps} contactDraft={{ bankDetails: [] }} />,
    );

    expect(html).toContain("contacts.form.noBankDetailsYet");
    expect(html).toContain("empty-message");
  });

  it("renders bank account cards with bankName, accountTitle, and accountNumber", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailsTab
        {...baseProps}
        contactDraft={{
          bankDetails: [
            {
              id: "bnk-1",
              bankName: "Meezan Bank",
              accountTitle: "Salaried Account",
              accountNumber: "010203040506",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Meezan Bank");
    expect(html).toContain("Salaried Account");
    expect(html).toContain("010203040506");
    expect(html).toContain("contacts.fields.bankName");
    expect(html).toContain("contacts.fields.bankAccountTitle");
    expect(html).toContain("contacts.fields.bankAccountNumber");
  });

  it("propagates field errors when present", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailsTab
        {...baseProps}
        getListItemError={(_group, field, _idx) =>
          field === "accountNumber" ? "Invalid account number" : undefined
        }
        contactDraft={{
          bankDetails: [
            {
              id: "bnk-1",
              bankName: "HBL",
              accountTitle: "Business Account",
              accountNumber: "",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Invalid account number");
    expect(html).toContain("field-error");
  });

  it("renders multiple bank cards with sequence counters and without primary logic", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailsTab
        {...baseProps}
        contactDraft={{
          bankDetails: [
            {
              id: "bnk-1",
              bankName: "Meezan Bank",
              accountTitle: "Title A",
              accountNumber: "010203040506",
            },
            {
              id: "bnk-2",
              bankName: "HBL",
              accountTitle: "Title B",
              accountNumber: "987654321000",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Meezan Bank");
    expect(html).toContain("HBL");
    expect(html).toContain("contacts.fields.bankName");
    expect(html).toContain('data-testid="card-type-select"');
    expect(html).not.toContain("contacts.form.bankAccountSequence");
    expect(html).not.toContain("contacts.form.primary");
    expect(html).not.toContain("contacts.form.setPrimary");
  });
});
