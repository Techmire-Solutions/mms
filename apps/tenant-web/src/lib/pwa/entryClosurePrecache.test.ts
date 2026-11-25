import { describe, expect, it, vi } from "vitest";
import {
  collectEntryClosure,
  createEntryClosureTransform,
  type ViteManifest,
} from "./entryClosurePrecache";

const manifest: ViteManifest = {
  "index.html": {
    file: "assets/index-AAA.js",
    css: ["assets/index-AAA.css"],
    imports: ["_vendor-react.js", "_vendor-ui.js"],
    isEntry: true,
  },
  "_vendor-react.js": { file: "assets/vendor-react-BBB.js", imports: ["_vendor-shared.js"] },
  "_vendor-shared.js": { file: "assets/vendor-shared-CCC.js" },
  "_vendor-ui.js": { file: "assets/vendor-ui-DDD.js", css: ["assets/vendor-ui-DDD.css"] },
  "_lazy-route.js": { file: "assets/LazyPage-EEE.js", imports: ["_vendor-elk.js"] },
  "_vendor-elk.js": { file: "assets/elk-FFF.js" },
};

describe("collectEntryClosure", () => {
  it("collects the entry, its static imports, and their CSS", () => {
    expect(collectEntryClosure(manifest)).toEqual([
      "assets/index-AAA.css",
      "assets/index-AAA.js",
      "assets/vendor-react-BBB.js",
      "assets/vendor-shared-CCC.js",
      "assets/vendor-ui-DDD.css",
      "assets/vendor-ui-DDD.js",
    ]);
  });

  it("excludes dynamically imported (lazy) chunks", () => {
    const closure = collectEntryClosure(manifest);

    expect(closure).not.toContain("assets/LazyPage-EEE.js");
    expect(closure).not.toContain("assets/elk-FFF.js");
  });

  it("tolerates cycles and duplicate files", () => {
    const cyclic: ViteManifest = {
      "index.html": { file: "assets/index-A.js", imports: ["_a.js"], isEntry: true },
      "_a.js": { file: "assets/a-B.js", imports: ["_b.js"] },
      "_b.js": { file: "assets/b-C.js", imports: ["_a.js", "_b.js"] },
    };

    expect(collectEntryClosure(cyclic)).toEqual([
      "assets/a-B.js",
      "assets/b-C.js",
      "assets/index-A.js",
    ]);
  });

  it("falls back to the index.html key when no chunk is flagged as entry", () => {
    const noFlag: ViteManifest = {
      "index.html": { file: "assets/index-A.js" },
      "_other.js": { file: "assets/other-B.js" },
    };

    expect(collectEntryClosure(noFlag)).toEqual(["assets/index-A.js"]);
  });

  it("returns an empty closure for an unknown entry", () => {
    expect(collectEntryClosure({}, "missing.html")).toEqual([]);
  });
});

describe("createEntryClosureTransform", () => {
  it("appends the closure to the glob-matched shell entries", () => {
    const transform = createEntryClosureTransform({ readManifest: () => manifest });

    const result = transform([
      { url: "/index.html", revision: "abc" },
      { url: "/favicon.svg", revision: null },
    ]);

    expect(result.manifest.slice(0, 2)).toEqual([
      { url: "/index.html", revision: "abc" },
      { url: "/favicon.svg", revision: null },
    ]);
    expect(result.manifest.map((entry) => entry.url)).toEqual([
      "/index.html",
      "/favicon.svg",
      "/assets/index-AAA.css",
      "/assets/index-AAA.js",
      "/assets/vendor-react-BBB.js",
      "/assets/vendor-shared-CCC.js",
      "/assets/vendor-ui-DDD.css",
      "/assets/vendor-ui-DDD.js",
    ]);
    // Hashed files are immutable: no revision cache-buster on the additions.
    expect(result.manifest.slice(2).every((entry) => entry.revision === null)).toBe(true);
  });

  it("does not duplicate entries already matched by globs", () => {
    const transform = createEntryClosureTransform({ readManifest: () => manifest });

    const result = transform([{ url: "/assets/index-AAA.js", revision: null }]);

    const urls = result.manifest.map((entry) => entry.url);
    expect(urls.filter((url) => url === "/assets/index-AAA.js")).toHaveLength(1);
  });

  it("leaves the manifest untouched when the build manifest is unavailable", () => {
    const transform = createEntryClosureTransform({ readManifest: () => null });

    const result = transform([{ url: "/index.html", revision: "abc" }]);

    expect(result.manifest).toEqual([{ url: "/index.html", revision: "abc" }]);
    expect(result.warnings?.[0]).toContain("build manifest unavailable");
  });

  it("leaves the manifest untouched when reading the manifest throws", () => {
    const readManifest = vi.fn(() => {
      throw new Error("ENOENT");
    });
    const transform = createEntryClosureTransform({ readManifest });

    const result = transform([{ url: "/index.html", revision: "abc" }]);

    expect(result.manifest).toEqual([{ url: "/index.html", revision: "abc" }]);
    expect(readManifest).toHaveBeenCalledTimes(1);
  });

  it("normalizes a leading slash exactly once", () => {
    const transform = createEntryClosureTransform({
      readManifest: () => ({ "index.html": { file: "/assets/index-A.js", isEntry: true } }),
    });

    expect(transform([]).manifest).toEqual([{ url: "/assets/index-A.js", revision: null }]);
  });
});
