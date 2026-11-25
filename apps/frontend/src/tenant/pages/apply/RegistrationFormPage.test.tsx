import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PublicRegistrationView } from "@mms/shared";
import RegistrationFormPage from "./RegistrationFormPage";

const mockUseTenant = vi.fn();
vi.mock("@/lib/contexts/TenantContext", () => ({
  useTenant: () => mockUseTenant(),
}));

let mockQueryState = {
  isPending: false,
  isError: false,
  data: undefined as PublicRegistrationView | undefined,
  refetch: vi.fn(),
};

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => mockQueryState,
  };
});

let mockFormState = {
  draft: {
    classId: "c1",
    fullName: "Zayd Harith",
    guardianName: "Harith",
    dateOfBirth: "2015-05-01",
    gender: "male",
    phone: "+92 300 1234567",
    email: "zayd@example.com",
    address: "Block 5",
    previousMadrasa: "None",
    website: "",
  },
  update: vi.fn(),
  canSubmit: true,
  isPending: false,
  outcome: { kind: "idle" } as unknown,
  eligibility: { eligible: true, reasons: [] },
  seatsLeft: 5,
  errors: {},
  submit: vi.fn(),
};

vi.mock("./useRegistrationForm", () => ({
  useRegistrationForm: () => mockFormState,
}));

const mockView: PublicRegistrationView = {
  slug: "session-hifz-2026",
  title: "Hifz Intensive 2026",
  madrasaName: "Dar Ul Quran",
  logoUrl: "https://example.com/logo.png",
  sessionName: "Hifz 2026",
  startDate: "2026-11-24",
  endDate: "2026-11-27",
  closesAt: "2026-11-28",
  acceptingSubmissions: true,
  classes: [
    {
      id: "c1",
      name: "Class 3 A",
      gender: "male",
      minAge: 8,
      maxAge: 12,
      ageCalculationDate: "2026-11-24",
      seatsLeft: 5,
    },
  ],
};

describe("RegistrationFormPage", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockUseTenant.mockReturnValue({
      workspace: { madrasaName: "Dar Ul Quran" },
      publicBranding: { logoUrl: "https://example.com/logo.png", madrasaName: "Dar Ul Quran" },
    });
    mockQueryState = {
      isPending: false,
      isError: false,
      data: mockView,
      refetch: vi.fn(),
    };
    mockFormState = {
      draft: {
        classId: "c1",
        fullName: "Zayd Harith",
        guardianName: "Harith",
        dateOfBirth: "2015-05-01",
        gender: "male",
        phone: "+92 300 1234567",
        email: "zayd@example.com",
        address: "Block 5",
        previousMadrasa: "None",
        website: "",
      },
      update: vi.fn(),
      canSubmit: true,
      isPending: false,
      outcome: { kind: "idle" },
      eligibility: { eligible: true, reasons: [] },
      seatsLeft: 5,
      errors: {},
      submit: vi.fn(),
    };
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  const renderWithProviders = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/apply/session-hifz-2026"]}>
            <Routes>
              <Route path="/apply/:slug" element={<RegistrationFormPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
  };

  it("renders brand header, branded card header, section titles, and back navigation link", async () => {
    await renderWithProviders();

    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length >= 1).toBe(true);
    expect(imgs[0]?.getAttribute("src")).toBe("https://example.com/logo.png");

    expect(
      container.textContent?.includes("Academic Selection") ||
        container.textContent?.includes("apply.sectionAcademic"),
    ).toBe(true);
    expect(
      container.textContent?.includes("Student & Guardian Details") ||
        container.textContent?.includes("apply.sectionStudent"),
    ).toBe(true);
    expect(
      container.textContent?.includes("Contact & Background") ||
        container.textContent?.includes("apply.sectionContact"),
    ).toBe(true);

    const links = Array.from(container.querySelectorAll("a"));
    const backLink = links.find((l) => l.getAttribute("href") === "/apply");
    expect(backLink?.tagName).toBe("A");

    const submitBtn = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        b.textContent?.includes("Submit application") || b.textContent?.includes("apply.submit"),
    );
    expect(submitBtn?.tagName).toBe("BUTTON");
  });

  it("renders monogram emblem fallback when logoUrl is absent", async () => {
    mockUseTenant.mockReturnValue({
      workspace: { madrasaName: "Dar Ul Quran" },
      publicBranding: { logoUrl: null, madrasaName: "Dar Ul Quran" },
    });
    mockQueryState.data = { ...mockView, logoUrl: null };

    await renderWithProviders();

    const monograms = container.querySelectorAll('[data-testid="admissions-brand-monogram"]');
    expect(monograms.length >= 1).toBe(true);
  });

  it("renders confirmation view on successful application submission", async () => {
    mockFormState.outcome = {
      kind: "success",
      reference: "APP-ABCD1234",
      status: "submitted",
    };

    await renderWithProviders();

    expect(
      container.textContent?.includes("Application received") ||
        container.textContent?.includes("apply.successTitle"),
    ).toBe(true);
    expect(container.textContent).toContain("APP-ABCD1234");
  });

  it("renders error state when registration link is not found", async () => {
    mockQueryState.data = undefined;
    mockQueryState.isError = true;

    await renderWithProviders();

    expect(
      container.textContent?.includes("Registration not found") ||
        container.textContent?.includes("apply.notFoundTitle"),
    ).toBe(true);
  });
});
