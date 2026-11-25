import { describe, expect, it } from "vitest";
import type { Contact, ValidationError } from "@mms/contracts";
import {
  readContactErrorFieldValue,
  reconcileContactValidationErrors,
} from "./contactLiveValidation.js";

const emailRowError: ValidationError = {
  fieldId: "address",
  tabId: "emails",
  index: 1,
  message: "Email must be unique",
};
const cnicError: ValidationError = { fieldId: "cnic", tabId: "basic", message: "CNIC taken" };

describe("readContactErrorFieldValue", () => {
  it("given a row error, should read the row field from the tab's collection", () => {
    // Arrange
    const draft = {
      emails: [{ address: "a@x.pk" }, { address: "b@x.pk" }],
    } as Partial<Contact>;

    // Act
    const value = readContactErrorFieldValue(draft, emailRowError);

    // Assert
    expect(value).toBe(JSON.stringify("b@x.pk"));
  });

  it("given a removed row, should read null", () => {
    // Arrange
    const draft = { emails: [{ address: "a@x.pk" }] } as Partial<Contact>;

    // Act
    const value = readContactErrorFieldValue(draft, emailRowError);

    // Assert
    expect(value).toBe("null");
  });

  it("given a custom collection tab, should read rows stored under the tab id", () => {
    // Arrange
    const error: ValidationError = { fieldId: "code", tabId: "custom_ids", index: 0, message: "x" };
    const draft = { custom_ids: [{ code: "GR-1" }] } as Partial<Contact>;

    // Act
    const value = readContactErrorFieldValue(draft, error);

    // Assert
    expect(value).toBe(JSON.stringify("GR-1"));
  });

  it("given a scalar custom field, should fall back to customFields", () => {
    // Arrange
    const error: ValidationError = { fieldId: "grNo", tabId: "basic", message: "x" };
    const draft = { customFields: { grNo: "42" } } as Partial<Contact>;

    // Act
    const value = readContactErrorFieldValue(draft, error);

    // Assert
    expect(value).toBe(JSON.stringify("42"));
  });
});

describe("reconcileContactValidationErrors", () => {
  it("given no shown errors, should return the same empty array", () => {
    // Arrange
    const current: ValidationError[] = [];

    // Act
    const next = reconcileContactValidationErrors({
      current,
      clientErrors: [cnicError],
      server: null,
      draft: {},
    });

    // Assert
    expect(next).toBe(current);
  });

  it("given a client error that still fails, should keep it and return the same array", () => {
    // Arrange
    const current = [cnicError];

    // Act
    const next = reconcileContactValidationErrors({
      current,
      clientErrors: [cnicError],
      server: null,
      draft: {},
    });

    // Assert
    expect(next).toBe(current);
  });

  it("given new client errors while typing, should not add them", () => {
    // Arrange
    const current = [cnicError];

    // Act
    const next = reconcileContactValidationErrors({
      current,
      clientErrors: [emailRowError],
      server: null,
      draft: {},
    });

    // Assert
    expect(next).toEqual([]);
  });

  it("given a server error, should keep it until its field value changes", () => {
    // Arrange
    const failedDraft = { cnic: "35202-1234567-1" } as Partial<Contact>;
    const server = { errors: [cnicError], draft: failedDraft };

    // Act
    const unchanged = reconcileContactValidationErrors({
      current: [cnicError],
      clientErrors: [],
      server,
      draft: { ...failedDraft, firstName: "Ali" },
    });
    const changed = reconcileContactValidationErrors({
      current: [cnicError],
      clientErrors: [],
      server,
      draft: { cnic: "35202-1234567-9" },
    });

    // Assert
    expect(unchanged).toEqual([cnicError]);
    expect(changed).toEqual([]);
  });
});
