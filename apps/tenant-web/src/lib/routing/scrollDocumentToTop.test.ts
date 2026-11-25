import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disableBrowserScrollRestoration,
  scrollDocumentToTop,
  scrollPageSurfaceToTop,
} from "@mms/ui/app/scrollDocumentToTop";

describe("scrollDocumentToTop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("scrolls the window and document elements to the top", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    document.documentElement.scrollTop = 240;
    document.body.scrollTop = 120;

    const main = document.createElement("main");
    main.id = "main-content";
    main.scrollTop = 80;
    document.body.appendChild(main);

    scrollDocumentToTop();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
    expect(main.scrollTop).toBe(0);
  });

  it("supports smooth behavior without forcing nested scroll tops", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    document.documentElement.scrollTop = 240;

    const main = document.createElement("main");
    main.id = "main-content";
    main.scrollTop = 80;
    document.body.appendChild(main);

    scrollDocumentToTop({ behavior: "smooth" });

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "smooth" });
    expect(document.documentElement.scrollTop).toBe(240);
    expect(main.scrollTop).toBe(80);
  });
});

describe("scrollPageSurfaceToTop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("uses document top on desktop", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1280);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const target = document.createElement("section");
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    scrollPageSurfaceToTop({ behavior: "smooth", mobileTarget: target });

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "smooth" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("uses the mobile target below the desktop breakpoint", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const target = document.createElement("section");
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    scrollPageSurfaceToTop({ behavior: "smooth", mobileTarget: target });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("honors a custom mobile block alignment", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
    const target = document.createElement("section");
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;

    scrollPageSurfaceToTop({ behavior: "smooth", mobileTarget: target, block: "nearest" });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
  });
});

describe("disableBrowserScrollRestoration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets history.scrollRestoration to manual", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.history, "scrollRestoration");
    let value: ScrollRestoration = "auto";
    Object.defineProperty(window.history, "scrollRestoration", {
      configurable: true,
      get: () => value,
      set: (next: ScrollRestoration) => {
        value = next;
      },
    });

    disableBrowserScrollRestoration();
    expect(window.history.scrollRestoration).toBe("manual");

    if (descriptor) {
      Object.defineProperty(window.history, "scrollRestoration", descriptor);
    }
  });
});
