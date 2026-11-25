import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PublicRegistrationView } from "@mms/shared";
import OpenRegistrationsPage from "./OpenRegistrationsPage";

const mockUseTenant = vi.fn();
vi.mock("@/lib/contexts/TenantContext", () => ({
  useTenant: () => mockUseTenant(),
}));

let mockQueryState = {
  isPending: false,
  isError: false,
  data: [] as PublicRegistrationView[],
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

const mockSessions: PublicRegistrationView[] = [
  {
    slug: "summer-hifz-2026",
    title: "Summer Hifz Camp",
    madrasaName: "Dar Ul Quran",
    logoUrl: "https://example.com/madrasa-logo.png",
    sessionName: "Summer 2026",
    startDate: "2026-06-01",
    endDate: "2026-08-01",
    closesAt: "2026-05-30",
    acceptingSubmissions: true,
    classes: [
      {
        id: "c1",
        name: "Morning Hifz",
        gender: "male",
        minAge: 7,
        maxAge: 15,
        ageCalculationDate: "2026-06-01",
        seatsLeft: 10,
      },
    ],
  },
];

describe("OpenRegistrationsPage", () => {
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
      publicBranding: {
        logoUrl: "https://example.com/madrasa-logo.png",
        madrasaName: "Dar Ul Quran",
      },
    });
    mockQueryState = {
      isPending: false,
      isError: false,
      data: mockSessions,
      refetch: vi.fn(),
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
          <MemoryRouter initialEntries={["/apply"]}>
            <OpenRegistrationsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
  };

  it("renders the institution logo image when logoUrl is provided", async () => {
    await renderWithProviders();

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/madrasa-logo.png");
    expect(container.textContent).toContain("Summer Hifz Camp");

    const links = Array.from(container.querySelectorAll("a"));
    const applyLink = links.find((l) => l.getAttribute("href") === "/apply/summer-hifz-2026");
    expect(applyLink?.tagName).toBe("A");
  });

  it("renders the monogram fallback when logoUrl is null", async () => {
    mockUseTenant.mockReturnValue({
      workspace: { madrasaName: "Dar Ul Quran" },
      publicBranding: { logoUrl: null, madrasaName: "Dar Ul Quran" },
    });
    mockQueryState.data = [{ ...mockSessions[0], logoUrl: null }];

    await renderWithProviders();

    expect(container.querySelector("img")).toBe(null);
    const monogram = container.querySelector('[data-testid="admissions-brand-monogram"]');
    expect(monogram?.textContent).toContain("DU");
  });

  it("renders the empty state with login link when no admissions are open", async () => {
    mockQueryState.data = [];

    await renderWithProviders();

    expect(
      container.textContent?.includes("No admissions are open right now") ||
        container.textContent?.includes("apply.noneOpen"),
    ).toBe(true);
    const links = Array.from(container.querySelectorAll("a"));
    const loginLink = links.find((l) => l.getAttribute("href") === "/login");
    expect(loginLink?.tagName).toBe("A");
  });

  it("renders centered responsive grid class for single card", async () => {
    await renderWithProviders();

    const list = container.querySelector("ul");
    expect(list?.className).toContain("grid-cols-1");
    expect(list?.className).toContain("max-w-md");
  });

  it("renders centered two-column responsive grid when two cards are present", async () => {
    mockQueryState.data = [
      mockSessions[0],
      { ...mockSessions[0], slug: "evening-nazra-2026", title: "Evening Nazra" },
    ];

    await renderWithProviders();

    const list = container.querySelector("ul");
    expect(list?.className).toContain("md:grid-cols-2");
    expect(list?.className).toContain("max-w-3xl");
  });
});
