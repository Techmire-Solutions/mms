import { describe, expect, it } from "vitest";
import {
  BREAKPOINT_SM_PX,
  BREAKPOINT_MD_PX,
  BREAKPOINT_LG_PX,
  BREAKPOINT_XL_PX,
  BREAKPOINT_2XL_PX,
  MEDIA_SM_UP,
  MEDIA_MD_UP,
  MEDIA_LG_UP,
  MEDIA_XL_UP,
  MEDIA_2XL_UP,
} from "@/lib/breakpoints";

describe("breakpoints", () => {
  it("exposes the Tailwind default breakpoint pixel values", () => {
    expect(BREAKPOINT_SM_PX).toBe(640);
    expect(BREAKPOINT_MD_PX).toBe(768);
    expect(BREAKPOINT_LG_PX).toBe(1024);
    expect(BREAKPOINT_XL_PX).toBe(1280);
    expect(BREAKPOINT_2XL_PX).toBe(1536);
  });

  it("builds min-width media queries from the pixel constants", () => {
    expect(MEDIA_SM_UP).toBe("(min-width: 640px)");
    expect(MEDIA_MD_UP).toBe("(min-width: 768px)");
    expect(MEDIA_LG_UP).toBe("(min-width: 1024px)");
    expect(MEDIA_XL_UP).toBe("(min-width: 1280px)");
    expect(MEDIA_2XL_UP).toBe("(min-width: 1536px)");
  });
});
