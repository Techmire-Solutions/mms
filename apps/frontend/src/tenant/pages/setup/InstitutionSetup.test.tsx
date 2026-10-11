import React from "react";
import { describe, expect, it } from "vitest";
import InstitutionSetup from "./InstitutionSetup";

describe("InstitutionSetup Component", () => {
  it("instantiates InstitutionSetup component definition", () => {
    const element = <InstitutionSetup />;
    expect(element.type).toBe(InstitutionSetup);
  });
});
