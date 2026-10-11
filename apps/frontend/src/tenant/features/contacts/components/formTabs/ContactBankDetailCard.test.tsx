import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactBankDetailCard } from "./ContactBankDetailCard";
import type { ContactBankDetail } from "@mms/shared";

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

vi.mock("@/components/ui/FormPrimitives", () => ({
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
  EditableSelect: ({
    value,
    options,
    placeholder,
  }: {
    value: string;
    options: string[];
    placeholder?: string;
  }) => (
    <div data-testid="editable-select" data-value={value} data-placeholder={placeholder}>
      <span>{value}</span>
      {options.map((opt) => (
        <span key={opt} data-testid="select-opt">
          {opt}
        </span>
      ))}
    </div>
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

vi.mock("@/components/ui/LeadingIconInput", () => ({
  LeadingIconInput: ({
    value,
    placeholder,
    "aria-invalid": ariaInvalid,
  }: {
    value: string;
    placeholder?: string;
    "aria-invalid"?: boolean;
  }) => (
    <input
      data-testid="leading-input"
      value={value}
      placeholder={placeholder}
      aria-invalid={ariaInvalid}
      readOnly
    />
  ),
}));

vi.mock("./ContactSubListCards", () => ({
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

const baseDetail: ContactBankDetail = {
  id: "bnk-test-1",
  bankName: "Meezan Bank",
  accountTitle: "Muhammad Ali",
  accountNumber: "010203040506",
};

const baseProps = {
  idx: 0,
  formInstanceId: "test-form",
  bankNameOptions: ["Meezan Bank", "HBL", "Standard Chartered"],
  showBankName: true,
  showAccountTitle: true,
  showAccountNumber: true,
  getListItemError: () => undefined,
  getLocalId: (_g: string, idx: number) => `local-bank-${idx}`,
  updateBankDetail: vi.fn(),
  removeBankDetail: vi.fn(),
};

describe("ContactBankDetailCard", () => {
  it("renders all visible fields with correct values", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailCard {...baseProps} bankDetail={baseDetail} />,
    );

    expect(html).toContain("Meezan Bank");
    expect(html).toContain("Muhammad Ali");
    expect(html).toContain("010203040506");
    expect(html).toContain("contacts.fields.bankName");
    expect(html).toContain("contacts.fields.bankAccountTitle");
    expect(html).toContain("contacts.fields.bankAccountNumber");
  });

  it("uses bank name in header typeSelect when enabled", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailCard {...baseProps} idx={1} bankDetail={baseDetail} />,
    );

    expect(html).toContain("contacts.fields.bankName");
    expect(html).toContain('data-testid="card-type-select"');
    expect(html).not.toContain("contacts.form.bankAccountSequence");
  });

  it("falls back to sequence label when bank name field is disabled", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailCard {...baseProps} idx={1} showBankName={false} bankDetail={baseDetail} />,
    );

    expect(html).toContain("contacts.form.bankAccountSequence:2");
    expect(html).not.toContain('data-testid="card-type-select"');
  });

  it("does not render primary badge or set-primary controls", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailCard {...baseProps} bankDetail={baseDetail} />,
    );

    expect(html).not.toContain("contacts.form.primary");
    expect(html).not.toContain("contacts.form.setPrimary");
    expect(html).not.toContain("contacts.fields.bankIsPrimary");
  });

  it("propagates field errors for bankName, accountTitle, and accountNumber", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailCard
        {...baseProps}
        getListItemError={(_group, field) => {
          if (field === "accountTitle") return "Invalid account title";
          if (field === "accountNumber") return "Invalid account number";
          if (field === "bankName") return "Select bank";
          return undefined;
        }}
        bankDetail={{ ...baseDetail, accountTitle: "", accountNumber: "", bankName: "" }}
      />,
    );

    expect(html).toContain("Invalid account title");
    expect(html).toContain("Invalid account number");
    expect(html).toContain("Select bank");
  });

  it("hides fields when disabled by field configuration", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailCard
        {...baseProps}
        showBankName={false}
        showAccountTitle={false}
        bankDetail={baseDetail}
      />,
    );

    expect(html).not.toContain("contacts.fields.bankName");
    expect(html).not.toContain("contacts.fields.bankAccountTitle");
    expect(html).toContain("contacts.fields.bankAccountNumber");
  });

  it("renders removal label in the card", () => {
    const html = renderToStaticMarkup(
      <ContactBankDetailCard {...baseProps} bankDetail={baseDetail} idx={2} />,
    );

    expect(html).toContain("contacts.form.removeBankDetail:3");
  });
});
