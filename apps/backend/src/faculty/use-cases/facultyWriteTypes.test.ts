import { describe, expect, it } from "vitest";
import { FacultyPermissionError } from "./facultyWriteTypes.js";

describe("facultyWriteTypes", () => {
  it("FacultyPermissionError sets statusCode 403 and type forbidden", () => {
    const error = new FacultyPermissionError();
    expect(error.statusCode).toBe(403);
    expect(error.type).toBe("forbidden");
    expect(error.name).toBe("FacultyPermissionError");
    expect(error.message).toBe("Restoring an archived faculty member requires delete permission");

    const custom = new FacultyPermissionError("Custom message");
    expect(custom.message).toBe("Custom message");
  });
});
