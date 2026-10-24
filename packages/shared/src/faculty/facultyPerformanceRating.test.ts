import { describe, expect, it } from "vitest";
import {
  clampFacultyPerformanceRating,
  computeFacultyPerformanceRating,
  formatFacultyPerformanceRating,
  parseFacultyPerformanceRating,
} from "./facultyPerformanceRating.js";

describe("clampFacultyPerformanceRating", () => {
  it("given out-of-range values, should clamp into 1.0–5.0 and round to one decimal", () => {
    // Act / Assert
    expect(clampFacultyPerformanceRating(0.2)).toBe(1);
    expect(clampFacultyPerformanceRating(7)).toBe(5);
    expect(clampFacultyPerformanceRating(3.456)).toBe(3.5);
  });
});

describe("computeFacultyPerformanceRating", () => {
  it("given evaluation ratings, should average them ignoring nullish or NaN entries", () => {
    // Arrange
    const ratings = [4, 5, null, undefined, Number.NaN, 3.5];

    // Act
    const rating = computeFacultyPerformanceRating(ratings);

    // Assert
    expect(rating).toBe(4.2);
  });

  it("given no valid ratings, should return null", () => {
    // Act / Assert
    expect(computeFacultyPerformanceRating([])).toBeNull();
    expect(computeFacultyPerformanceRating([null, undefined])).toBeNull();
  });
});

describe("parseFacultyPerformanceRating", () => {
  it("given a numeric(2,1) string from storage, should parse to a rounded number", () => {
    // Act / Assert
    expect(parseFacultyPerformanceRating("4.3")).toBe(4.3);
    expect(parseFacultyPerformanceRating(2.26)).toBe(2.3);
  });

  it("given empty, non-numeric, or out-of-range input, should return null", () => {
    // Act / Assert
    expect(parseFacultyPerformanceRating(null)).toBeNull();
    expect(parseFacultyPerformanceRating("")).toBeNull();
    expect(parseFacultyPerformanceRating("abc")).toBeNull();
    expect(parseFacultyPerformanceRating(0.9)).toBeNull();
    expect(parseFacultyPerformanceRating(5.1)).toBeNull();
  });
});

describe("formatFacultyPerformanceRating", () => {
  it('given a rating, should render "x.y / 5"; otherwise the fallback', () => {
    // Act / Assert
    expect(formatFacultyPerformanceRating(4)).toBe("4.0 / 5");
    expect(formatFacultyPerformanceRating(null)).toBe("—");
    expect(formatFacultyPerformanceRating(undefined, "Unrated")).toBe("Unrated");
  });
});
