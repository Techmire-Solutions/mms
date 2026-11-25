import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RouteAnnouncer } from "./RouteAnnouncer";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Page({ heading, to }: { heading: string; to: string }): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <main id="main-content" tabIndex={-1}>
      <h1>{heading}</h1>
      <button type="button" onClick={() => navigate(to)}>
        {`go ${to}`}
      </button>
    </main>
  );
}

function DelayedPage(): React.JSX.Element {
  const [heading, setHeading] = React.useState("");
  React.useEffect(() => {
    const timer = window.setTimeout(() => setHeading("Delayed page"), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main id="main-content" tabIndex={-1}>
      {heading ? <h1>{heading}</h1> : null}
    </main>
  );
}

function ModalPage(): React.JSX.Element {
  return (
    <main id="main-content" tabIndex={-1}>
      <h1>Modal page</h1>
      <div role="dialog" aria-modal="true" aria-label="Confirm">
        <button type="button">Confirm</button>
      </div>
    </main>
  );
}

describe("RouteAnnouncer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async (destination: string): Promise<void> => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/a"]}>
          <RouteAnnouncer />
          <Routes>
            <Route path="/a" element={<Page heading="Page A" to={destination} />} />
            <Route path="/b" element={<Page heading="Page B" to="/b" />} />
            <Route path="/delayed" element={<DelayedPage />} />
            <Route path="/modal" element={<ModalPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  };

  const navigateTo = async (label: string): Promise<void> => {
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent === label,
    );
    expect(button, `button ${label} should exist`).toBeDefined();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  const liveRegion = (): Element | null => container.querySelector('[role="status"]');

  it("given the first render, should stay silent when the app boots", async () => {
    // Act
    await render("/b");

    // Assert
    expect(liveRegion()?.textContent).toBe("");
    expect(document.activeElement?.id).not.toBe("main-content");
  });

  it("given a route change, should focus the main landmark and announce the heading when navigated", async () => {
    // Arrange
    await render("/b");

    // Act
    await navigateTo("go /b");

    // Assert
    expect(document.activeElement?.id).toBe("main-content");
    expect(liveRegion()?.textContent).toBe("Page B");
  });

  it("given a delayed heading after navigation, should announce it when the heading appears", async () => {
    // Arrange
    await render("/delayed");

    // Act
    await navigateTo("go /delayed");

    // Assert
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(liveRegion()?.textContent).toBe("Delayed page");
    expect(document.activeElement?.id).toBe("main-content");
  });

  it("given an open modal dialog after navigation, should not steal focus when the route change lands", async () => {
    // Arrange
    await render("/modal");

    // Act
    await navigateTo("go /modal");

    // Assert
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement?.id).not.toBe("main-content");
  });
});
