import { describe, expect, it, vi } from "vitest";
import type { Faculty } from "@mms/shared";
import {
  guardBulkSubordinatesOnDelete,
  guardSubordinatesOnDelete,
  SubordinateReassignmentError,
  SubordinateReassignmentUnavailableError,
} from "../faculty/use-cases/facultySoftDeleteGuards.js";
import { ConflictError } from "../lib/httpErrors.js";
import type { FacultyRepository } from "../faculty/repository/facultyRepository.js";

const TENANT = "tenant-faculty";

describe("facultySoftDeleteGuards", () => {
  describe("guardSubordinatesOnDelete", () => {
    it("given faculty with 0 subordinates, should return cleanly without throwing", async () => {
      // Arrange
      const mockRepo = {
        countSubordinates: vi.fn().mockResolvedValue(0),
        findById: vi.fn(),
        reassignSubordinates: vi.fn(),
      } as unknown as FacultyRepository;

      // Act & Assert
      await expect(
        guardSubordinatesOnDelete(TENANT, "fac-1", undefined, mockRepo),
      ).resolves.toBeUndefined();
      expect(mockRepo.findById).not.toHaveBeenCalled();
      expect(mockRepo.reassignSubordinates).not.toHaveBeenCalled();
    });

    it("given faculty with subordinates and no reassignment target, should throw SubordinateReassignmentError", async () => {
      // Arrange
      const mockRepo = {
        countSubordinates: vi.fn().mockResolvedValue(3),
      } as unknown as FacultyRepository;

      // Act & Assert
      await expect(guardSubordinatesOnDelete(TENANT, "fac-1", undefined, mockRepo)).rejects.toThrow(
        SubordinateReassignmentError,
      );
      await expect(
        guardSubordinatesOnDelete(TENANT, "fac-1", "   ", mockRepo),
      ).rejects.toMatchObject({
        statusCode: 409,
        message:
          "Cannot delete faculty member with 3 active subordinate(s). Please reassign subordinates before deletion.",
      });
    });

    it("given reassignment target matching the deleting faculty member ID, should throw ConflictError", async () => {
      // Arrange
      const mockRepo = {
        countSubordinates: vi.fn().mockResolvedValue(2),
      } as unknown as FacultyRepository;

      // Act & Assert
      await expect(guardSubordinatesOnDelete(TENANT, "fac-1", "fac-1", mockRepo)).rejects.toThrow(
        ConflictError,
      );
      await expect(
        guardSubordinatesOnDelete(TENANT, "fac-1", "fac-1", mockRepo),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Cannot reassign subordinates to the faculty member being deleted",
      });
    });

    it("given reassignment target that does not exist in repository, should throw ConflictError", async () => {
      // Arrange
      const mockRepo = {
        countSubordinates: vi.fn().mockResolvedValue(2),
        findById: vi.fn().mockResolvedValue(null),
      } as unknown as FacultyRepository;

      // Act & Assert
      await expect(
        guardSubordinatesOnDelete(TENANT, "fac-1", "fac-nonexistent", mockRepo),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Target supervisor for reassignment does not exist or has been deleted",
      });
    });

    it("given reassignment target that is soft-deleted, should throw ConflictError", async () => {
      // Arrange
      const mockRepo = {
        countSubordinates: vi.fn().mockResolvedValue(2),
        findById: vi
          .fn()
          .mockResolvedValue({ id: "fac-deleted", deletedAt: new Date() } as unknown as Faculty),
      } as unknown as FacultyRepository;

      // Act & Assert
      await expect(
        guardSubordinatesOnDelete(TENANT, "fac-1", "fac-deleted", mockRepo),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Target supervisor for reassignment does not exist or has been deleted",
      });
    });

    it("refuses the reassignment request instead of reporting a no-op success", async () => {
      // The organization-position model was removed, so `reassignSubordinates` is a
      // no-op in production. Accepting the target archived the supervisor, returned
      // 200 and left every subordinate pointing at a deleted chain.
      const mockRepo = {
        countSubordinates: vi.fn().mockResolvedValue(2),
        findById: vi
          .fn()
          .mockResolvedValue({ id: "fac-target", deletedAt: null } as unknown as Faculty),
        reassignSubordinates: vi.fn().mockResolvedValue(0),
      } as unknown as FacultyRepository;

      await expect(
        guardSubordinatesOnDelete(TENANT, "fac-1", "fac-target", mockRepo),
      ).rejects.toThrow(SubordinateReassignmentUnavailableError);
      await expect(
        guardSubordinatesOnDelete(TENANT, "fac-1", "fac-target", mockRepo),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mockRepo.reassignSubordinates).not.toHaveBeenCalled();
    });
  });

  describe("guardBulkSubordinatesOnDelete", () => {
    it("given repo without countSubordinatesBatch, should return cleanly", async () => {
      // Arrange
      const mockRepo = {} as unknown as FacultyRepository;

      // Act & Assert
      await expect(
        guardBulkSubordinatesOnDelete(TENANT, ["fac-1", "fac-2"], mockRepo),
      ).resolves.toBeUndefined();
    });

    it("given all faculty members in batch have 0 subordinates, should return cleanly", async () => {
      // Arrange
      const mockRepo = {
        countSubordinatesBatch: vi.fn().mockResolvedValue({ "fac-1": 0, "fac-2": 0 }),
      } as unknown as FacultyRepository;

      // Act & Assert
      await expect(
        guardBulkSubordinatesOnDelete(TENANT, ["fac-1", "fac-2"], mockRepo),
      ).resolves.toBeUndefined();
    });

    it("given supervisor whose subordinates are all within the deleted batch, should pass", async () => {
      // Arrange
      const mockRepo = {
        countSubordinatesBatch: vi.fn().mockResolvedValue({ "fac-1": 1 }),
        findSubordinates: vi
          .fn()
          .mockResolvedValue([{ id: "fac-2", deletedAt: null }] as unknown as Faculty[]),
      } as unknown as FacultyRepository;

      // Act & Assert
      // Both fac-1 and fac-2 are deleted in the same bulk operation
      await expect(
        guardBulkSubordinatesOnDelete(TENANT, ["fac-1", "fac-2"], mockRepo),
      ).resolves.toBeUndefined();
    });

    it("given supervisor with an active subordinate outside the deleted batch, should throw SubordinateReassignmentError", async () => {
      // Arrange
      const mockRepo = {
        countSubordinatesBatch: vi.fn().mockResolvedValue({ "fac-1": 1 }),
        findSubordinates: vi
          .fn()
          .mockResolvedValue([{ id: "fac-external-sub", deletedAt: null }] as unknown as Faculty[]),
      } as unknown as FacultyRepository;

      // Act & Assert
      await expect(guardBulkSubordinatesOnDelete(TENANT, ["fac-1"], mockRepo)).rejects.toThrow(
        SubordinateReassignmentError,
      );
    });
  });
});
