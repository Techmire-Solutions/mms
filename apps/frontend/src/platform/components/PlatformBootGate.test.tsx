import React from "react";
import { describe, expect, it } from "vitest";
import PlatformBootGate, { PlatformFallbackRoute } from "./PlatformBootGate";

describe("PlatformBootGate Component", () => {
  it("instantiates PlatformBootGate component definition", () => {
    const gateElement = <PlatformBootGate requireAuth requireSuperUser />;
    expect(gateElement.type).toBe(PlatformBootGate);
  });

  it("instantiates PlatformFallbackRoute component definition", () => {
    const fallbackElement = <PlatformFallbackRoute />;
    expect(fallbackElement.type).toBe(PlatformFallbackRoute);
  });
});
