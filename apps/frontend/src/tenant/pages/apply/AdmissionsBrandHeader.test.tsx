import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { AdmissionsBrandHeader } from "./AdmissionsBrandHeader";

describe("AdmissionsBrandHeader", () => {
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

  it("renders the institution logo image when logoUrl is provided", async () => {
    await act(async () => {
      root.render(
        <AdmissionsBrandHeader
          logoUrl="https://example.com/logo.png"
          institutionName="Dar Ul Quran"
        />,
      );
    });

    const img = container.querySelector("img");
    expect(img?.tagName).toBe("IMG");
    expect(img?.getAttribute("src")).toBe("https://example.com/logo.png");
    expect(img?.getAttribute("alt")).toBe("Dar Ul Quran");
    expect(container.querySelector('[data-testid="admissions-brand-monogram"]')).toBe(null);
  });

  it("renders the monogram fallback badge with initials when logoUrl is absent", async () => {
    await act(async () => {
      root.render(<AdmissionsBrandHeader logoUrl={null} institutionName="Dar Ul Quran" />);
    });

    expect(container.querySelector("img")).toBe(null);
    const badge = container.querySelector('[data-testid="admissions-brand-monogram"]');
    expect(badge?.getAttribute("aria-label")).toBe("Dar Ul Quran");
    expect(badge?.textContent).toContain("DU");
  });

  it("falls back to monogram when image triggers onError", async () => {
    await act(async () => {
      root.render(
        <AdmissionsBrandHeader
          logoUrl="https://example.com/broken-logo.png"
          institutionName="Al Huda"
        />,
      );
    });

    const img = container.querySelector("img");
    expect(img?.tagName).toBe("IMG");

    await act(async () => {
      img?.dispatchEvent(new Event("error"));
    });

    const badge = container.querySelector('[data-testid="admissions-brand-monogram"]');
    expect(badge?.getAttribute("aria-label")).toBe("Al Huda");
    expect(badge?.textContent).toContain("AH");
  });

  it("renders institution name and trust badge subtitle", async () => {
    await act(async () => {
      root.render(
        <AdmissionsBrandHeader
          institutionName="Al-Hikmah Academy"
          subtitle="Trusted Online Admissions"
        />,
      );
    });

    expect(container.textContent).toContain("Al-Hikmah Academy");
    expect(container.textContent).toContain("Trusted Online Admissions");
  });

  it("renders optional hero title and subtitle when provided", async () => {
    await act(async () => {
      root.render(
        <AdmissionsBrandHeader
          institutionName="Dar Ul Quran"
          heroTitle="Open Admissions 2026-2027"
          heroSubtitle="Join our comprehensive Islamic studies program."
        />,
      );
    });

    const heading = container.querySelector("h1");
    expect(heading?.textContent).toBe("Open Admissions 2026-2027");
    expect(container.textContent).toContain("Join our comprehensive Islamic studies program.");
  });
});
