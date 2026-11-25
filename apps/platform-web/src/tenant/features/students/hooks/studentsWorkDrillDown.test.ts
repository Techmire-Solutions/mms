import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STUDENTS_WORK_DRILLDOWN_EVENT,
  applyStudentsWorkDrillDown,
  consumeStudentsWorkDrillDown,
  type StudentsWorkDrillDown,
} from "@/tenant/features/students/hooks/studentsWorkDrillDown";

const filter: StudentsWorkDrillDown = { status: "active" };

describe("applyStudentsWorkDrillDown", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("persists the filter to sessionStorage and dispatches a CustomEvent", () => {
    const listener = vi.fn();
    window.addEventListener(STUDENTS_WORK_DRILLDOWN_EVENT, listener);

    applyStudentsWorkDrillDown(filter);

    expect(sessionStorage.getItem("mms_students_work_drilldown")).toBe(JSON.stringify(filter));
    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual(filter);
  });
});

describe("consumeStudentsWorkDrillDown", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips an applied filter and removes it from storage", () => {
    applyStudentsWorkDrillDown(filter);
    expect(consumeStudentsWorkDrillDown()).toEqual(filter);
    expect(sessionStorage.getItem("mms_students_work_drilldown")).toBeNull();
    expect(consumeStudentsWorkDrillDown()).toBeNull();
  });

  it("returns null when storage is empty", () => {
    expect(consumeStudentsWorkDrillDown()).toBeNull();
  });

  it("returns null and clears corrupt JSON", () => {
    sessionStorage.setItem("mms_students_work_drilldown", "{not-json");
    expect(consumeStudentsWorkDrillDown()).toBeNull();
    expect(sessionStorage.getItem("mms_students_work_drilldown")).toBeNull();
  });
});
