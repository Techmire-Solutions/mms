import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { PublicRegistrationView } from "@mms/shared";
import { AdmissionsCard } from "./AdmissionsCard";

const mockItem: PublicRegistrationView = {
  slug: "session-hifz-2026",
  title: "Hifz Intensive 2026",
  madrasaName: "Dar Ul Quran",
  sessionName: "Hifz 2026",
  startDate: "2026-11-24",
  endDate: "2026-11-27",
  closesAt: "2026-11-28",
  acceptingSubmissions: true,
  classes: [
    {
      id: "cls-1",
      name: "Class 3 A",
      gender: "male",
      minAge: 8,
      maxAge: 12,
      ageCalculationDate: "2026-11-24",
      seatsLeft: 5,
    },
  ],
};

describe("AdmissionsCard", () => {
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

  it("renders session title, dates, deadline, and classes metadata cleanly", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdmissionsCard item={mockItem} />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Hifz Intensive 2026");
    expect(container.textContent).toContain("Class 3 A");
    expect(
      container.textContent?.includes("5 seats left") ||
        container.textContent?.includes("apply.seatsLeft"),
    ).toBe(true);

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/apply/session-hifz-2026");
  });

  it("renders waitlist status when all classes have 0 seats left", async () => {
    const waitlistItem: PublicRegistrationView = {
      ...mockItem,
      classes: [{ ...mockItem.classes[0], seatsLeft: 0 }],
    };

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AdmissionsCard item={waitlistItem} />
        </MemoryRouter>,
      );
    });

    expect(
      container.textContent?.includes("Waitlist only") ||
        container.textContent?.includes("apply.waitlistOnly"),
    ).toBe(true);
  });
});
