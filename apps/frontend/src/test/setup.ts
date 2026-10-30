import { afterEach } from "vitest";

export {};

// Declare React 19 Act Environment globally
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Responsive & Media Query APIs
if (typeof window !== "undefined") {
  // Prevent happy-dom from making live outbound HTTP requests for external stylesheets (e.g. Google Fonts)
  const happyDomSettings = (
    window as unknown as { happyDOM?: { settings?: Record<string, unknown> } }
  )?.happyDOM?.settings;
  if (happyDomSettings) {
    happyDomSettings.disableCSSFileLoading = true;
    happyDomSettings.handleDisabledFileLoadingAsSuccess = true;
  }

  if (!window.matchMedia) {
    const matchMediaStub = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: matchMediaStub,
    });
    globalThis.matchMedia ??= matchMediaStub;
  }

  // Window Opener for OAuth Popup Flows
  let currentOpener: Window | null = null;
  Object.defineProperty(window, "opener", {
    get: () => currentOpener,
    set: (val: Window | null) => {
      currentOpener = val;
    },
    configurable: true,
    enumerable: true,
  });
}

// Observers (ResizeObserver & IntersectionObserver)
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
if (typeof window !== "undefined") {
  window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
}

class IntersectionObserverStub {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver ??=
  IntersectionObserverStub as unknown as typeof IntersectionObserver;
if (typeof window !== "undefined") {
  window.IntersectionObserver ??=
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// Scrolling APIs (Window & Element targets)
if (typeof window !== "undefined") {
  window.scrollTo ??= () => {};
  window.scrollBy ??= () => {};
  window.scroll ??= () => {};

  if (typeof Element !== "undefined") {
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.scrollTo ??= () => {};
    Element.prototype.scrollBy ??= () => {};
  }
}

// Canvas 2D & Export APIs
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext ??= (() => ({
    fillRect: () => {},
    clearRect: () => {},
    getImageData: (x: number, y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
      colorSpace: "srgb" as PredefinedColorSpace,
    }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toDataURL ??= () => "data:image/png;base64,";
  HTMLCanvasElement.prototype.toBlob ??= (cb) => {
    cb?.(new Blob([], { type: "image/png" }));
  };
}

// Object URL Lifecycle (Downloads & Previews)
if (typeof URL !== "undefined") {
  URL.createObjectURL ??= () => "blob:mock-url";
  URL.revokeObjectURL ??= () => {};
}

// Suppress unhandled rejections from happy-dom Web Animations API when animations are canceled
if (typeof window !== "undefined") {
  if (typeof window.Animation !== "undefined") {
    const originalCancel = window.Animation.prototype.cancel;
    window.Animation.prototype.cancel = function (this: Animation) {
      this.finished?.catch(() => {});
      return originalCancel.call(this);
    };
  }
  if (typeof Element !== "undefined" && Element.prototype.animate) {
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      const animation = originalAnimate.apply(this, args);
      animation.finished?.catch(() => {});
      return animation;
    };
  }
}

// Global teardown: clear document nodes and residual test storage
afterEach(() => {
  if (typeof document !== "undefined") {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  }
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.clear();
  }
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});
