import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkshopEvent, WorkshopPreferences } from "@mms/contracts";
import { useWorkshopFormController } from "./useWorkshopFormController";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  onSave: vi.fn(),
  onClose: vi.fn(),
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const workshop: WorkshopEvent = {
  id: "w1",
  title: "Quran Circle",
  description: "Weekly halaqa",
  startDate: "2026-12-01",
  endDate: "2026-12-15",
  registrationDeadline: "2026-11-25",
  capacity: 20,
  fee: 150,
  programId: null,
  subjectId: null,
  minAttendancePct: 75,
  minScorePct: 60,
  participantCount: 3,
  waitlistEnabled: true,
  status: "open",
  phase: "registration_open",
};

const defaults: WorkshopPreferences = {
  defaultMinAttendancePct: 80,
  defaultMinScorePct: 65,
};

function renderController({
  initialData,
  defaults: prefs = null,
}: {
  initialData: WorkshopEvent | null;
  defaults?: WorkshopPreferences | null;
}) {
  let latest!: ReturnType<typeof useWorkshopFormController>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  const Harness = () => {
    latest = useWorkshopFormController({
      initialData,
      defaults: prefs,
      onSave: mocks.onSave,
      onClose: mocks.onClose,
    });
    return null;
  };

  act(() => root.render(<Harness />));
  return {
    get: () => latest,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useWorkshopFormController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onSave.mockResolvedValue(undefined);
    mocks.onClose.mockImplementation(() => {});
  });

  it("seeds every field from the edit payload and starts clean", () => {
    const { get, unmount } = renderController({ initialData: workshop });
    expect(get().values).toMatchObject({
      title: "Quran Circle",
      capacity: "20",
      fee: "150",
      minAttendancePct: "75",
      waitlistEnabled: true,
    });
    expect(get().isDirty).toBe(false);
    unmount();
  });

  it("takes a fresh snapshot per mount (new modal key semantics)", () => {
    const first = renderController({ initialData: workshop });
    act(() => first.get().setField("title", "Renamed"));
    expect(first.get().isDirty).toBe(true);
    first.unmount();

    const second = renderController({ initialData: { ...workshop, title: "Second Session" } });
    expect(second.get().values.title).toBe("Second Session");
    expect(second.get().isDirty).toBe(false);
    second.unmount();
  });

  it("seeds completion criteria from Setup defaults for a new workshop", () => {
    const { get, unmount } = renderController({ initialData: null, defaults });
    expect(get().values.minAttendancePct).toBe("80");
    expect(get().values.minScorePct).toBe("65");
    expect(get().values.capacity).toBe("");
    expect(get().isDirty).toBe(false);
    unmount();
  });

  it("computes isDirty against the mount snapshot, including a revert", () => {
    const { get, unmount } = renderController({ initialData: workshop });
    act(() => get().setField("capacity", "25"));
    expect(get().isDirty).toBe(true);
    act(() => get().setField("capacity", "20"));
    expect(get().isDirty).toBe(false);
    unmount();
  });

  it("submits the parsed payload and closes only on success", async () => {
    const { get, unmount } = renderController({ initialData: workshop });
    await act(async () => {
      await get().handleSubmit();
    });
    expect(mocks.onSave).toHaveBeenCalledTimes(1);
    expect(mocks.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Quran Circle",
        capacity: 20,
        fee: 150,
        minAttendancePct: 75,
        waitlistEnabled: true,
      }),
    );
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("ignores a second submit while a save is in flight", async () => {
    let resolveSave!: () => void;
    mocks.onSave.mockImplementation(() => new Promise<void>((resolve) => (resolveSave = resolve)));
    const { get, unmount } = renderController({ initialData: workshop });

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = get().handleSubmit();
      second = get().handleSubmit();
      await Promise.resolve();
    });
    expect(mocks.onSave).toHaveBeenCalledTimes(1);
    expect(get().saving).toBe(true);

    await act(async () => {
      resolveSave();
      await first;
      await second;
    });
    expect(mocks.onSave).toHaveBeenCalledTimes(1);
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    expect(get().saving).toBe(false);
    unmount();
  });

  it("surfaces a translated validation message without saving", async () => {
    const { get, unmount } = renderController({
      initialData: { ...workshop, title: "" },
    });
    await act(async () => {
      await get().handleSubmit();
    });
    expect(mocks.onSave).not.toHaveBeenCalled();
    expect(get().error).toBe("workshops.validation.titleRequired");
    unmount();
  });
});
