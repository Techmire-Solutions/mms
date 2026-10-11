import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { useDirectoryTrashState } from "@/hooks/useDirectoryTrashState";
import { ModuleWorkToolbar } from "@/components/ui/ModuleWorkToolbar";
import { ModuleTrashToggle } from "@/components/ui/ModuleTrashToggle";
import { ModuleWorkBulkActionBar } from "@/components/ui/ModuleWorkBulkActionBar";
import {
  EntityArchivedBanner,
  RetentionCountdownBadge,
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
  calculateRemainingRetentionDays,
} from "@/components/ui/DetailDrawerArchiveChrome";
import { ContactArchivedBanner } from "@/tenant/features/contacts/components/ContactArchivedBanner";
import { StudentArchivedBanner } from "@/tenant/features/students/components/StudentArchivedBanner";
import { FacultyArchivedBanner } from "@/tenant/features/faculty/components/FacultyArchivedBanner";
import { SessionArchivedBanner } from "@/tenant/features/sessions/components/SessionArchivedBanner";
import { ContactDetailDrawerHeaderActions } from "@/tenant/features/contacts/components/detail/ContactDetailDrawerChrome";
import { notify } from "@/lib/notify";
import { Toaster } from "@/components/ui/toaster";
import type { Contact, Student, Faculty, Session } from "@mms/shared";
import {
  useOptimisticSoftDelete,
  type UseOptimisticSoftDeleteOptions,
} from "@/hooks/useOptimisticSoftDelete";
import { useModuleWorkKeyboardShortcuts } from "@/hooks/useModuleWorkKeyboardShortcuts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({
    viewMode: "table",
    setViewMode: vi.fn(),
  }),
}));

describe("Soft-Delete UX Architecture Integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  describe("1. URL state synchronization (?view=trash)", () => {
    function renderTrashHook(initialEntries: string[] = ["/"]) {
      let viewingDeleted!: boolean;
      let setViewingDeleted!: (show: boolean) => void;
      let currentSearch = "";

      function TestComponent() {
        const [viewing, setViewing] = useDirectoryTrashState();
        viewingDeleted = viewing;
        setViewingDeleted = setViewing;
        currentSearch = useLocation().search;
        return null;
      }

      act(() => {
        root.render(
          <MemoryRouter initialEntries={initialEntries}>
            <TestComponent />
          </MemoryRouter>,
        );
      });

      return {
        get viewingDeleted() {
          return viewingDeleted;
        },
        setViewingDeleted,
        get search() {
          return currentSearch;
        },
      };
    }

    it("preserves active search and facet query parameters when toggling to trash mode", () => {
      const hook = renderTrashHook(["/?q=math&status=enrolled&branch=main"]);
      expect(hook.viewingDeleted).toBe(false);

      act(() => {
        hook.setViewingDeleted(true);
      });

      expect(hook.viewingDeleted).toBe(true);
      expect(hook.search).toContain("view=trash");
      expect(hook.search).toContain("q=math");
      expect(hook.search).toContain("status=enrolled");
      expect(hook.search).toContain("branch=main");
    });

    it("removes trash parameters while retaining search and facet filters on toggle back to active", () => {
      const hook = renderTrashHook(["/?view=trash&q=history&grade=10"]);
      expect(hook.viewingDeleted).toBe(true);

      act(() => {
        hook.setViewingDeleted(false);
      });

      expect(hook.viewingDeleted).toBe(false);
      expect(hook.search).not.toContain("view=trash");
      expect(hook.search).toContain("q=history");
      expect(hook.search).toContain("grade=10");
    });

    it("supports useDirectoryTrashState with tuple and object properties including toggleTrash", () => {
      let state!: ReturnType<typeof useDirectoryTrashState>;
      function TestComponent() {
        state = useDirectoryTrashState();
        return null;
      }
      act(() => {
        root.render(
          <MemoryRouter initialEntries={["/?q=students&status=active"]}>
            <TestComponent />
          </MemoryRouter>,
        );
      });
      expect(state.viewingDeleted).toBe(false);
      expect(state[0]).toBe(false);

      act(() => {
        state.toggleTrash();
      });
      expect(state.viewingDeleted).toBe(true);
      expect(state[0]).toBe(true);

      act(() => {
        state.toggleTrash();
      });
      expect(state.viewingDeleted).toBe(false);
      expect(state[0]).toBe(false);
    });
  });

  describe("2. Toolbar Add/Create CTA visibility in trash mode", () => {
    it("renders primaryAction (Add/Create CTA) when viewingDeleted is false", () => {
      act(() => {
        root.render(
          <ModuleWorkToolbar
            regionLabel="Students actions"
            search=""
            onSearchChange={vi.fn()}
            searchPlaceholder="Search students..."
            primaryAction={<button data-testid="add-record-cta">Add Student</button>}
            trashToggle={{
              canViewDeleted: true,
              viewingDeleted: false,
              onToggle: vi.fn(),
              activeLabel: "Active",
              deletedLabel: "Trash",
            }}
          />,
        );
      });

      expect(container.querySelector('[data-testid="add-record-cta"]')).not.toBeNull();
    });

    it("hides primaryAction (Add/Create CTA) when viewingDeleted is true", () => {
      act(() => {
        root.render(
          <ModuleWorkToolbar
            regionLabel="Students actions"
            search=""
            onSearchChange={vi.fn()}
            searchPlaceholder="Search students..."
            primaryAction={<button data-testid="add-record-cta">Add Student</button>}
            trashToggle={{
              canViewDeleted: true,
              viewingDeleted: true,
              onToggle: vi.fn(),
              activeLabel: "Active",
              deletedLabel: "Trash",
            }}
          />,
        );
      });

      expect(container.querySelector('[data-testid="add-record-cta"]')).toBeNull();
    });
  });

  describe("3. Toolbar Export CTA visibility with showExportInTrash", () => {
    it("renders export children in active mode regardless of showExportInTrash", () => {
      act(() => {
        root.render(
          <ModuleWorkToolbar
            regionLabel="Students actions"
            search=""
            onSearchChange={vi.fn()}
            searchPlaceholder="Search students..."
            showExportInTrash={false}
            trashToggle={{
              canViewDeleted: true,
              viewingDeleted: false,
              onToggle: vi.fn(),
              activeLabel: "Active",
              deletedLabel: "Trash",
            }}
          >
            <button data-testid="export-cta">Export CSV</button>
          </ModuleWorkToolbar>,
        );
      });

      expect(container.querySelector('[data-testid="export-cta"]')).not.toBeNull();
    });

    it("renders export children in trash mode when showExportInTrash is true (or default)", () => {
      act(() => {
        root.render(
          <ModuleWorkToolbar
            regionLabel="Students actions"
            search=""
            onSearchChange={vi.fn()}
            searchPlaceholder="Search students..."
            trashToggle={{
              canViewDeleted: true,
              viewingDeleted: true,
              onToggle: vi.fn(),
              activeLabel: "Active",
              deletedLabel: "Trash",
            }}
          >
            <button data-testid="export-cta">Export CSV</button>
          </ModuleWorkToolbar>,
        );
      });

      expect(container.querySelector('[data-testid="export-cta"]')).not.toBeNull();
    });

    it("hides export children in trash mode when showExportInTrash is false", () => {
      act(() => {
        root.render(
          <ModuleWorkToolbar
            regionLabel="Students actions"
            search=""
            onSearchChange={vi.fn()}
            searchPlaceholder="Search students..."
            showExportInTrash={false}
            trashToggle={{
              canViewDeleted: true,
              viewingDeleted: true,
              onToggle: vi.fn(),
              activeLabel: "Active",
              deletedLabel: "Trash",
            }}
          >
            <button data-testid="export-cta">Export CSV</button>
          </ModuleWorkToolbar>,
        );
      });

      expect(container.querySelector('[data-testid="export-cta"]')).toBeNull();
    });

    it("renders ModuleTrashToggle with aria-pressed=false and Show Trash in active mode", () => {
      const onToggle = vi.fn();
      act(() => {
        root.render(
          <ModuleTrashToggle
            showDeleted={false}
            onToggle={onToggle}
            showActiveLabel="Show Active"
            showDeletedLabel="Show Trash"
          />,
        );
      });
      const btn = container.querySelector("button");
      expect(btn).not.toBeNull();
      expect(btn?.getAttribute("aria-pressed")).toBe("false");
      expect(btn?.textContent).toContain("Show Trash");

      act(() => {
        btn?.click();
      });
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it("renders ModuleTrashToggle with aria-pressed=true and Show Active in trash mode", () => {
      act(() => {
        root.render(
          <ModuleTrashToggle
            viewingDeleted={true}
            onToggle={vi.fn()}
            activeLabel="Show Active"
            deletedLabel="Show Trash"
          />,
        );
      });
      const btn = container.querySelector("button");
      expect(btn).not.toBeNull();
      expect(btn?.getAttribute("aria-pressed")).toBe("true");
      expect(btn?.textContent).toContain("Show Active");
    });
  });

  describe("3. Bulk selection actions in trash vs active mode", () => {
    it("renders BulkSelectionDeleteAction and hides restore action in active mode", () => {
      const onRequestDelete = vi.fn();
      const onRequestRestore = vi.fn();
      act(() => {
        root.render(
          <ModuleWorkBulkActionBar
            selectedCount={2}
            viewingDeleted={false}
            countLabel="2 items selected"
            leading={<span>Icon</span>}
            deselectLabel="Clear selection"
            canDelete={true}
            restoreLabel="Restore selected"
            onRequestBulkRestore={onRequestRestore}
            onClearSelection={vi.fn()}
            deleteAction={{
              label: "Delete selected",
              onClick: onRequestDelete,
            }}
          />,
        );
      });

      expect(container.textContent).toContain("Delete selected");
      expect(container.textContent).not.toContain("Restore selected");
    });

    it("renders BulkSelectionRestoreAction and hides delete action in trash mode", () => {
      const onRequestDelete = vi.fn();
      const onRequestRestore = vi.fn();
      act(() => {
        root.render(
          <ModuleWorkBulkActionBar
            selectedCount={2}
            viewingDeleted={true}
            countLabel="2 items selected"
            leading={<span>Icon</span>}
            deselectLabel="Clear selection"
            canDelete={true}
            restoreLabel="Restore selected"
            onRequestBulkRestore={onRequestRestore}
            onClearSelection={vi.fn()}
            deleteAction={{
              label: "Delete selected",
              onClick: onRequestDelete,
            }}
          />,
        );
      });

      expect(container.textContent).toContain("Restore selected");
      expect(container.textContent).not.toContain("Delete selected");
    });
  });

  describe("4. Detail drawer archive banner rendering", () => {
    it("renders EntityArchivedBanner with warning callout and reason when deletedAt is present", () => {
      const html = renderToStaticMarkup(
        <EntityArchivedBanner
          deletedAt="2026-03-01T10:00:00.000Z"
          deletionReason="Course completed"
          titleWithDate={(date) => `Archived on ${date}`}
          reasonLabel="Reason"
          retentionDays={30}
        />,
      );

      expect(html).toContain("Archived on");
      expect(html).toContain("Reason: Course completed");
      expect(html).toContain('role="status"');
    });

    it("renders null (empty markup) when deletedAt is null or undefined", () => {
      const htmlNull = renderToStaticMarkup(
        <EntityArchivedBanner
          deletedAt={null}
          titleWithDate={(date) => `Archived on ${date}`}
          reasonLabel="Reason"
        />,
      );
      expect(htmlNull).toBe("");

      const htmlUndefined = renderToStaticMarkup(
        <EntityArchivedBanner
          deletedAt={undefined}
          titleWithDate={(date) => `Archived on ${date}`}
          reasonLabel="Reason"
        />,
      );
      expect(htmlUndefined).toBe("");
    });

    it("calculates retention remaining days and handles purgeAfter accurately", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
      try {
        // Deleted 2 days ago with 5 days retention -> 3 days remaining (warning)
        const days = calculateRemainingRetentionDays("2026-02-27T12:00:00Z", 5);
        expect(days).toBe(3);

        // purgeAfter explicit timestamp in 4 days -> 4 days remaining
        const purgeDays = calculateRemainingRetentionDays(
          "2026-02-20T12:00:00Z",
          30,
          "2026-03-05T12:00:00Z",
        );
        expect(purgeDays).toBe(4);

        // indefinite (null retentionDays and no purgeAfter)
        expect(calculateRemainingRetentionDays("2026-02-20T12:00:00Z", null)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("renders RetentionCountdownBadge with warning tone when <= 7 days remain", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
      try {
        const warningHtml = renderToStaticMarkup(
          <RetentionCountdownBadge deletedAt="2026-02-26T12:00:00Z" retentionDays={8} />,
        );
        expect(warningHtml).toContain("⚠️ common.purgesInDays");
        expect(warningHtml).toContain("text-destructive");

        const indefiniteHtml = renderToStaticMarkup(
          <RetentionCountdownBadge deletedAt="2026-02-26T12:00:00Z" retentionDays={null} />,
        );
        expect(indefiniteHtml).toContain("common.archivedIndefinitely");
      } finally {
        vi.useRealTimers();
      }
    });

    it("renders DetailDrawerArchivedBanner with retention countdown and description", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
      try {
        const bannerHtml = renderToStaticMarkup(
          <DetailDrawerArchivedBanner
            deletedAt="2026-02-26T12:00:00Z"
            title="Archived Session"
            description="Term ended"
            retentionDays={8}
          />,
        );
        expect(bannerHtml).toContain("Term ended");
        expect(bannerHtml).toContain("⚠️ common.purgesInDays");
      } finally {
        vi.useRealTimers();
      }
    });

    it("renders DetailDrawerRestoreOrEditAction: edit in active mode, restore in archived mode", () => {
      const onEdit = vi.fn();
      const onRestore = vi.fn();

      // Active mode
      const activeHtml = renderToStaticMarkup(
        <DetailDrawerRestoreOrEditAction
          isArchived={false}
          canRestore={true}
          canEdit={true}
          restoreLabel="Restore record"
          editLabel="Edit profile"
          onEdit={onEdit}
          onRestore={onRestore}
        />,
      );
      expect(activeHtml).toContain('title="Edit profile"');
      expect(activeHtml).not.toContain("Restore record");

      // Archived mode
      const archivedHtml = renderToStaticMarkup(
        <DetailDrawerRestoreOrEditAction
          isArchived={true}
          canRestore={true}
          canEdit={true}
          restoreLabel="Restore record"
          editLabel="Edit profile"
          onEdit={onEdit}
          onRestore={onRestore}
        />,
      );
      expect(archivedHtml).toContain('title="Restore record"');
      expect(archivedHtml).not.toContain("Edit profile");

      // Archived mode without canRestore
      const forbiddenRestoreHtml = renderToStaticMarkup(
        <DetailDrawerRestoreOrEditAction
          isArchived={true}
          canRestore={false}
          canEdit={true}
          restoreLabel="Restore record"
          editLabel="Edit profile"
          onEdit={onEdit}
          onRestore={onRestore}
        />,
      );
      expect(forbiddenRestoreHtml).toBe("");
    });
  });

  describe("4b. Module-specific archived banners (Contact, Student, Faculty, Session)", () => {
    it("renders ContactArchivedBanner with retention info when deletedAt is present", () => {
      const archivedContact: Contact = {
        id: "cnt-1",
        name: "Tariq Jamil",
        firstName: "Tariq",
        lastName: "Jamil",
        deletedAt: "2026-02-26T12:00:00Z",
        deletionReason: "Relocated overseas",
      };
      const html = renderToStaticMarkup(<ContactArchivedBanner contact={archivedContact} />);
      expect(html).toContain("contacts.detail.archivedBanner");
      expect(html).toContain("Relocated overseas");
      expect(html).toContain('role="status"');
    });

    it("renders null for ContactArchivedBanner when contact is active (deletedAt is undefined)", () => {
      const activeContact: Contact = {
        id: "cnt-2",
        name: "Amir Khan",
        firstName: "Amir",
        lastName: "Khan",
        deletedAt: undefined,
      };
      const html = renderToStaticMarkup(<ContactArchivedBanner contact={activeContact} />);
      expect(html).toBe("");
    });

    it("renders StudentArchivedBanner with countdown and warning tone when <= 7 days remain", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
      try {
        const student: Student = {
          id: "std-1",
          contactId: "cnt-1",
          name: "Hamza Ali",
          gender: "male",
          status: "active",
          deletedAt: "2026-02-26T12:00:00Z",
          deletionReason: "Graduated",
          retentionDays: 8,
        } as unknown as Student;
        const html = renderToStaticMarkup(<StudentArchivedBanner student={student} />);
        expect(html).toContain("Graduated");
        expect(html).toContain("⚠️ common.purgesInDays");
      } finally {
        vi.useRealTimers();
      }
    });

    it("renders null for StudentArchivedBanner when student is active", () => {
      const activeStudent: Student = {
        id: "std-2",
        contactId: "cnt-2",
        name: "Bilal",
        gender: "male",
        status: "active",
        deletedAt: undefined,
      };
      const html = renderToStaticMarkup(<StudentArchivedBanner student={activeStudent} />);
      expect(html).toBe("");
    });

    it("renders FacultyArchivedBanner with standard countdown when > 7 days remain", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
      try {
        const faculty: Faculty = {
          id: "tch-1",
          name: "Ustadh Umar",
          status: "active",
          deletedAt: "2026-02-20T12:00:00Z",
          deletionReason: "Contract ended",
          retentionDays: 30,
        } as unknown as Faculty;
        const html = renderToStaticMarkup(<FacultyArchivedBanner faculty={faculty} />);
        expect(html).toContain("Contract ended");
        expect(html).toContain("common.purgesInDays");
      } finally {
        vi.useRealTimers();
      }
    });

    it("renders null for FacultyArchivedBanner when faculty is active", () => {
      const activeFaculty: Faculty = {
        id: "tch-2",
        contactId: "cnt-2",
        name: "Ustadh Zaid",
        status: "active",
        deletedAt: undefined,
      };
      const html = renderToStaticMarkup(<FacultyArchivedBanner faculty={activeFaculty} />);
      expect(html).toBe("");
    });

    it("renders SessionArchivedBanner with indefinite retention badge when retentionDays is null", () => {
      const session: Session = {
        id: "ses-1",
        name: "Hifz Summer 2026",
        type: "regular",
        status: "active",
        startDate: "2026-06-01",
        endDate: "2026-08-31",
        baseFee: 150,
        currency: "USD",
        deletedAt: "2026-02-20T12:00:00Z",
        deletionReason: "Course merged",
      } as unknown as Session;
      const html = renderToStaticMarkup(<SessionArchivedBanner session={session} />);
      expect(html).toContain("Course merged");
      expect(html).toContain("common.archivedIndefinitely");
      expect(html).toContain('role="status"');
    });

    it("renders null for SessionArchivedBanner when session is active", () => {
      const activeSession: Session = {
        id: "ses-2",
        name: "Fall 2026",
        type: "regular",
        status: "active",
        startDate: "2026-09-01",
        endDate: "2026-12-31",
        baseFee: 150,
        currency: "USD",
        deletedAt: undefined,
      } as unknown as Session;
      const html = renderToStaticMarkup(<SessionArchivedBanner session={activeSession} />);
      expect(html).toBe("");
    });

    it("gates ContactDetailDrawerHeaderActions: shows restore in trash, shows edit in active", () => {
      const onEdit = vi.fn();
      const onRestore = vi.fn();

      const archivedContact: Contact = {
        id: "cnt-1",
        name: "Tariq Jamil",
        firstName: "Tariq",
        lastName: "Jamil",
        deletedAt: "2026-02-26T12:00:00Z",
      };

      const archivedHtml = renderToStaticMarkup(
        <ContactDetailDrawerHeaderActions
          canWrite={true}
          canDelete={true}
          contact={archivedContact}
          onEdit={onEdit}
          onRestore={onRestore}
        />,
      );
      expect(archivedHtml).toContain("contacts.restoreContact");
      expect(archivedHtml).toContain("lucide-rotate-ccw");
      expect(archivedHtml).not.toContain("contacts.detail.editProfile");

      const activeContact: Contact = {
        id: "cnt-2",
        name: "Amir Khan",
        firstName: "Amir",
        lastName: "Khan",
        deletedAt: undefined,
      };

      const activeHtml = renderToStaticMarkup(
        <ContactDetailDrawerHeaderActions
          canWrite={true}
          canDelete={true}
          contact={activeContact}
          onEdit={onEdit}
          onRestore={onRestore}
        />,
      );
      expect(activeHtml).toContain("contacts.detail.editProfile");
      expect(activeHtml).not.toContain("contacts.restoreContact");
      expect(activeHtml).not.toContain("lucide-rotate-ccw");
    });
  });

  describe("5. Optimistic soft-delete hook (useOptimisticSoftDelete)", () => {
    interface TestItem {
      id: string;
      name: string;
    }

    function renderHookWrapper(options: UseOptimisticSoftDeleteOptions<TestItem[]>) {
      let hookResult!: ReturnType<typeof useOptimisticSoftDelete<TestItem[]>>;

      function TestComponent() {
        hookResult = useOptimisticSoftDelete(options);
        return null;
      }

      act(() => {
        root.render(<TestComponent />);
      });

      return {
        get current() {
          return hookResult;
        },
      };
    }

    it("optimistically updates cache, calls deleteFn, and triggers notifyArchivedWithUndo", async () => {
      const queryClient = new QueryClient();
      const queryKey = ["students", "list"] as const;
      const initialData: TestItem[] = [
        { id: "s1", name: "Alice" },
        { id: "s2", name: "Bob" },
      ];
      queryClient.setQueryData(queryKey, initialData);

      const deleteFn = vi.fn().mockResolvedValue(undefined);
      const restoreFn = vi.fn().mockResolvedValue(undefined);
      let capturedOnUndo: (() => void | Promise<void>) | null = null;
      let capturedRecordName: string | undefined;

      const notifyArchivedWithUndo = vi.fn(
        (onUndo: () => void | Promise<void>, recordName?: string) => {
          capturedOnUndo = onUndo;
          capturedRecordName = recordName;
        },
      );

      const { current } = renderHookWrapper({
        queryClient,
        queryKey,
        removeFromSnapshot: (items, id) => items.filter((item) => item.id !== id),
        deleteFn,
        restoreFn,
        notifyArchivedWithUndo,
      });

      await act(async () => {
        await current.optimisticDelete("s1", "Alice", "Left school");
      });

      // Optimistic cache state
      expect(queryClient.getQueryData(queryKey)).toEqual([{ id: "s2", name: "Bob" }]);
      expect(deleteFn).toHaveBeenCalledWith("s1", "Left school");
      expect(notifyArchivedWithUndo).toHaveBeenCalledTimes(1);
      expect(capturedRecordName).toBe("Alice");

      // Test undo execution
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
      expect(capturedOnUndo).not.toBeNull();
      await act(async () => {
        await capturedOnUndo!();
      });

      expect(restoreFn).toHaveBeenCalledWith("s1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
    });

    it("rolls back cache to initial snapshot when deleteFn fails", async () => {
      const queryClient = new QueryClient();
      const queryKey = ["students", "list"] as const;
      const initialData: TestItem[] = [
        { id: "s1", name: "Alice" },
        { id: "s2", name: "Bob" },
      ];
      queryClient.setQueryData(queryKey, initialData);

      const deleteFn = vi.fn().mockRejectedValue(new Error("Database write failed"));
      const restoreFn = vi.fn();
      const notifyArchivedWithUndo = vi.fn();

      const { current } = renderHookWrapper({
        queryClient,
        queryKey,
        removeFromSnapshot: (items, id) => items.filter((item) => item.id !== id),
        deleteFn,
        restoreFn,
        notifyArchivedWithUndo,
      });

      let thrownError: unknown = null;
      await act(async () => {
        try {
          await current.optimisticDelete("s1", "Alice");
        } catch (err) {
          thrownError = err;
        }
      });

      expect(thrownError).toBeInstanceOf(Error);
      expect((thrownError as Error).message).toBe("Database write failed");
      // Assert rollback to initialData
      expect(queryClient.getQueryData(queryKey)).toEqual(initialData);
      expect(notifyArchivedWithUndo).not.toHaveBeenCalled();
    });
  });

  describe("5b. Undo toast interaction with Toaster and notify.archivedWithUndo", () => {
    it("renders toast with Undo button via notify.archivedWithUndo and triggers onUndo callback", async () => {
      const onUndo = vi.fn().mockResolvedValue(undefined);

      act(() => {
        root.render(<Toaster />);
      });

      act(() => {
        notify.archivedWithUndo("Contact archived: John Doe", onUndo, {
          undoLabel: "Undo",
          duration: 8000,
        });
      });

      expect(container.textContent).toContain("Contact archived: John Doe");
      const undoBtn = container.querySelector('[role="button"]') as HTMLElement | null;
      expect(undoBtn).not.toBeNull();
      expect(undoBtn?.textContent).toBe("Undo");

      await act(async () => {
        undoBtn?.click();
      });

      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });

  describe("6. Keyboard shortcut guards (Cmd/Ctrl+N)", () => {
    it("fires onCreate when canWrite is true and viewingDeleted is false", () => {
      const onCreate = vi.fn();
      function TestKeyboard() {
        useModuleWorkKeyboardShortcuts({
          searchInputId: "work-search-1",
          canWrite: true,
          viewingDeleted: false,
          onCreate,
        });
        return <input id="work-search-1" />;
      }
      act(() => {
        root.render(<TestKeyboard />);
      });

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }),
        );
      });
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it("blocks onCreate when viewingDeleted is true", () => {
      const onCreate = vi.fn();
      function TestKeyboard() {
        useModuleWorkKeyboardShortcuts({
          searchInputId: "work-search-2",
          canWrite: true,
          viewingDeleted: true,
          onCreate,
        });
        return <input id="work-search-2" />;
      }
      act(() => {
        root.render(<TestKeyboard />);
      });

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }),
        );
      });
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("blocks onCreate when canWrite is false", () => {
      const onCreate = vi.fn();
      function TestKeyboard() {
        useModuleWorkKeyboardShortcuts({
          searchInputId: "work-search-3",
          canWrite: false,
          viewingDeleted: false,
          onCreate,
        });
        return <input id="work-search-3" />;
      }
      act(() => {
        root.render(<TestKeyboard />);
      });

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }),
        );
      });
      expect(onCreate).not.toHaveBeenCalled();
    });
  });
});
