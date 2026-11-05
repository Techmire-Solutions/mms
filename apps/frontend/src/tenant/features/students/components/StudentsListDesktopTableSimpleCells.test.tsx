import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Student } from "@mms/shared";
import {
  renderStudentDobCell,
  renderStudentSessionsCell,
  renderStudentStatusCell,
} from "./StudentsListDesktopTableSimpleCells";

const mockTranslate = ((key: string, params?: Record<string, string | number>) => {
  if (key === "students.list.ageYears" && params?.age != null) {
    return `${params.age} years`;
  }
  if (key === "students.list.notEnrolled") {
    return "Not enrolled";
  }
  return key;
}) as never;

const mockStudent: Student = {
  id: "std-simple-1",
  contactId: "cnt-1",
  name: "Zayd Harith",
  gender: "male",
  grNumber: "GR-55",
  status: "active",
  dob: "2015-06-15",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("StudentsListDesktopTableSimpleCells", () => {
  it("renders student DOB cell with calculated age and formatted date", () => {
    const html = renderToStaticMarkup(
      <div>
        {renderStudentDobCell({
          studentRow: mockStudent,
          emptyDash: "—",
          t: mockTranslate,
        })}
      </div>,
    );

    expect(html).toContain("years");
    expect(html).toContain("2015");
  });

  it("renders student DOB cell emptyDash when DOB is missing", () => {
    const html = renderToStaticMarkup(
      <div>
        {renderStudentDobCell({
          studentRow: { ...mockStudent, dob: undefined },
          emptyDash: "—",
          t: mockTranslate,
        })}
      </div>,
    );

    expect(html).toContain("—");
  });

  it("renders session badges when student is enrolled", () => {
    const html = renderToStaticMarkup(
      <div>
        {renderStudentSessionsCell({
          sessionNames: ["Quran Morning", "Hadith Evening"],
          t: mockTranslate,
        })}
      </div>,
    );

    expect(html).toContain("Quran Morning");
    expect(html).toContain("Hadith Evening");
  });

  it("renders not-enrolled note when sessionNames is empty", () => {
    const html = renderToStaticMarkup(
      <div>
        {renderStudentSessionsCell({
          sessionNames: [],
          t: mockTranslate,
        })}
      </div>,
    );

    expect(html).toContain("Not enrolled");
  });

  it("renders status badge", () => {
    const html = renderToStaticMarkup(
      <div>
        {renderStudentStatusCell({
          studentRow: mockStudent,
          statusBadgeConfig: {
            active: { label: "Active", cls: "bg-success/10 text-success" },
          },
        })}
      </div>,
    );

    expect(html).toContain("Active");
  });
});
