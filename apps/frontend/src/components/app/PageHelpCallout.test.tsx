import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PageHelpCallout } from "./PageHelpCallout";

async function mountCallout(
  id = "sessions",
  steps: readonly string[] = ["Create a session", "Add its classes", "Export as CSV"],
): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      <PageHelpCallout id={id} title="How to use this page" steps={steps} />,
    );
  });
  return container;
}

describe("PageHelpCallout", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("given steps, should render the heading and every step when mounted", async () => {
    // Arrange / Act
    const container = await mountCallout();

    // Assert
    expect(container.querySelector("h2")?.textContent).toBe("How to use this page");
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.textContent).toContain("Export as CSV");
  });

  it("given a dismiss click, should hide the callout and persist the flag when dismissed", async () => {
    // Arrange
    const container = await mountCallout("sessions");
    const dismissBtn = container.querySelector("button[aria-label='common.dismiss']");

    // Act
    await act(async () => {
      (dismissBtn as HTMLButtonElement)?.click();
    });

    // Assert
    expect(container.querySelector("h2")).toBeNull();
    expect(localStorage.getItem("mms.pageHelp.dismissed.sessions")).toBe("1");
  });

  it("given a previously dismissed id, should render nothing when mounted", async () => {
    // Arrange
    localStorage.setItem("mms.pageHelp.dismissed.sessions", "1");

    // Act
    const container = await mountCallout("sessions");

    // Assert
    expect(container.querySelector("h2")).toBeNull();
  });

  it("given an empty step list, should render nothing when mounted", async () => {
    // Arrange / Act
    const container = await mountCallout("empty", []);

    // Assert
    expect(container.querySelector("h2")).toBeNull();
  });
});
