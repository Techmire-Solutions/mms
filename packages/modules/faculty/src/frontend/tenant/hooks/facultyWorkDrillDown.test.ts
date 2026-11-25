import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FACULTY_WORK_DRILLDOWN_EVENT,
  applyFacultyWorkDrillDown,
  consumeFacultyWorkDrillDown,
  type FacultyWorkDrillDown,
} from "./facultyWorkDrillDown";

const filter: FacultyWorkDrillDown = { quickFilter: "active" };

describe("applyFacultyWorkDrillDown", () => {
  const mockHandler = vi.fn<(e: Event) => void>();
  const listener: EventListener = (e: Event) => {
    mockHandler(e);
  };

  beforeEach(() => {
    sessionStorage.clear();
    mockHandler.mockClear();
  });

  afterEach(() => {
    window.removeEventListener(FACULTY_WORK_DRILLDOWN_EVENT, listener);
  });

  it("persists the filter to sessionStorage and dispatches a CustomEvent", () => {
    window.addEventListener(FACULTY_WORK_DRILLDOWN_EVENT, listener);

    applyFacultyWorkDrillDown(filter);

    expect(sessionStorage.getItem("mms_faculty_work_drilldown")).toBe(JSON.stringify(filter));
    expect(mockHandler).toHaveBeenCalledOnce();
    const event = mockHandler.mock.calls[0]?.[0] as CustomEvent<FacultyWorkDrillDown>;
    expect(event.detail).toEqual(filter);
  });
});

describe("consumeFacultyWorkDrillDown", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips an applied filter and removes it from storage", () => {
    applyFacultyWorkDrillDown(filter);
    expect(consumeFacultyWorkDrillDown()).toEqual(filter);
    expect(sessionStorage.getItem("mms_faculty_work_drilldown")).toBeNull();
    expect(consumeFacultyWorkDrillDown()).toBeNull();
  });

  it("returns null when storage is empty", () => {
    expect(consumeFacultyWorkDrillDown()).toBeNull();
  });

  it("returns null and clears corrupt JSON", () => {
    sessionStorage.setItem("mms_faculty_work_drilldown", "{not-json");
    expect(consumeFacultyWorkDrillDown()).toBeNull();
    expect(sessionStorage.getItem("mms_faculty_work_drilldown")).toBeNull();
  });
});
