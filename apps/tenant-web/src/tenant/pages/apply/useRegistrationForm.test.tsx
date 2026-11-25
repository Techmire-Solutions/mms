import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { REGISTRATION_INELIGIBLE_ERROR_TYPE, type PublicRegistrationView } from "@mms/contracts";
import { ApiError } from "@mms/fe-core/api/errors";
import { useRegistrationForm } from "./useRegistrationForm";

const mockMutateAsync = vi.fn();

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/query/registrationQueries", () => ({
  PUBLIC_REGISTRATION_QUERY_KEY: ["public-registration"],
  submitRegistrationMutationOptions: () => ({
    mutationFn: mockMutateAsync,
  }),
}));

const sampleView: PublicRegistrationView = {
  madrasaName: "Test Madrasa",
  logoUrl: null,
  slug: "fall-2026",
  title: "Fall Admissions",
  sessionName: "2026",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  closesAt: null,
  acceptingSubmissions: true,
  classes: [
    {
      id: "cls-1",
      name: "Class 1",
      gender: "male",
      minAge: 5,
      maxAge: 15,
      ageCalculationDate: "2026-09-01",
      seatsLeft: 4,
    },
  ],
};

function renderFormHook(slug: string, view: PublicRegistrationView | undefined) {
  let latest!: ReturnType<typeof useRegistrationForm>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Harness({ currentView }: { currentView: PublicRegistrationView | undefined }) {
    latest = useRegistrationForm(slug, currentView);
    return null;
  }

  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Harness currentView={view} />
      </QueryClientProvider>,
    );
  });

  return {
    get: () => latest,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useRegistrationForm", () => {
  let harness: ReturnType<typeof renderFormHook> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    harness?.cleanup();
    harness = null;
  });

  it("validates fields, clears errors on update, and reports validation errors", async () => {
    harness = renderFormHook("fall-2026", sampleView);
    expect(harness.get().canSubmit).toBe(false);

    // No-op when incomplete
    await act(async () => {
      await harness!.get().submit();
    });
    expect(mockMutateAsync).not.toHaveBeenCalled();

    // Fill fields with an invalid phone/dob format or short phone to hit zod safeParse failure
    act(() => {
      harness!.get().update("classId", "cls-1");
      harness!.get().update("fullName", "A");
      harness!.get().update("guardianName", "B");
      harness!.get().update("dateOfBirth", "2018-05-01");
      harness!.get().update("gender", "male");
      harness!.get().update("phone", "1");
    });

    expect(harness.get().seatsLeft).toBe(4);
    expect(harness.get().eligibility?.eligible).toBe(true);
    expect(harness.get().canSubmit).toBe(true);

    await act(async () => {
      await harness!.get().submit();
    });
    expect(harness.get().outcome.kind).toBe("error");
    expect(Object.keys(harness.get().errors).length).toBeGreaterThan(0);

    // Updating a field clears its inline error; updating clean field keeps state intact
    act(() => {
      harness!.get().update("phone", "+923001234567");
      harness!.get().update("address", "Street 1");
    });
    expect(harness.get().errors.phone).toBeUndefined();
  });

  it("submits successfully and handles API ineligible and generic errors", async () => {
    mockMutateAsync.mockResolvedValueOnce({ reference: "REG-100", status: "submitted" });
    harness = renderFormHook("fall-2026", sampleView);

    act(() => {
      harness!.get().update("classId", "cls-1");
      harness!.get().update("fullName", "Zayd Harith");
      harness!.get().update("guardianName", "Harith Ali");
      harness!.get().update("dateOfBirth", "2018-05-01");
      harness!.get().update("gender", "male");
      harness!.get().update("phone", "+923001234567");
    });

    await act(async () => {
      await harness!.get().submit();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(harness.get().outcome).toEqual({
      kind: "success",
      reference: "REG-100",
      status: "submitted",
    });

    // Ineligible API error branch
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError(422, "gender_mismatch,age_too_young", REGISTRATION_INELIGIBLE_ERROR_TYPE),
    );
    await act(async () => {
      await harness!.get().submit();
    });
    expect(harness.get().outcome).toMatchObject({
      kind: "error",
      reasons: ["gender_mismatch", "age_too_young"],
      type: REGISTRATION_INELIGIBLE_ERROR_TYPE,
    });

    // Non-Error rejection branch
    mockMutateAsync.mockRejectedValueOnce("unexpected");
    await act(async () => {
      await harness!.get().submit();
    });
    expect(harness.get().outcome).toEqual({
      kind: "error",
      reasons: [],
      message: "",
      type: undefined,
    });
  });
});
