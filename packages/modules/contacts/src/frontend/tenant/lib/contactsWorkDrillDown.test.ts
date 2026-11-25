import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactsWorkDrillDown } from "@mms/contracts";
import {
  CONTACTS_WORK_DRILLDOWN_EVENT,
  applyContactsWorkDrillDown,
  consumeContactsWorkDrillDown,
} from "./contactsWorkDrillDown.js";

const filter: ContactsWorkDrillDown = { quickFilter: "active" };

describe("applyContactsWorkDrillDown", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("persists the filter to sessionStorage and dispatches a CustomEvent", () => {
    const listener = vi.fn();
    window.addEventListener(CONTACTS_WORK_DRILLDOWN_EVENT, listener);

    applyContactsWorkDrillDown(filter);

    expect(sessionStorage.getItem("mms_contacts_work_drilldown")).toBe(JSON.stringify(filter));
    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual(filter);
  });
});

describe("consumeContactsWorkDrillDown", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips an applied filter and removes it from storage", () => {
    applyContactsWorkDrillDown(filter);
    expect(consumeContactsWorkDrillDown()).toEqual(filter);
    expect(sessionStorage.getItem("mms_contacts_work_drilldown")).toBeNull();
    expect(consumeContactsWorkDrillDown()).toBeNull();
  });

  it("returns null when storage is empty", () => {
    expect(consumeContactsWorkDrillDown()).toBeNull();
  });

  it("returns null and clears corrupt JSON", () => {
    sessionStorage.setItem("mms_contacts_work_drilldown", "{not-json");
    expect(consumeContactsWorkDrillDown()).toBeNull();
    expect(sessionStorage.getItem("mms_contacts_work_drilldown")).toBeNull();
  });
});
