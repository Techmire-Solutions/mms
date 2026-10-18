import { Children, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "@/components/app/ProgressBar";

/**
 * Regression tests for a systemic ARIA conflict.
 *
 * Eight call sites (attendance, accounting, sessions, profile, question-bank,
 * dashboard charts) pass `aria-hidden="true"` to mark a bar decorative. Because
 * the component spread `...props` onto the same element that carried
 * `role="progressbar"`, the markup both declared a widget AND hid it from
 * assistive technology — an axe `aria-hidden-focus` violation at every one of
 * those sites, and a progress value screen readers never received.
 *
 * The behaviour now lives in the component, so callers cannot reintroduce it.
 *
 * NOTE ON STYLE: this workspace has no DOM renderer (no `@testing-library/react`;
 * `happy-dom` is configured but existing component tests assert on the element
 * tree). `ProgressBar` is a pure function with no hooks, so invoking it and
 * inspecting the returned element's props gives exact assertions on the ARIA
 * contract without adding a dependency. These tests are deliberately stronger
 * than the `expect(el.type).toBe(X)` pattern elsewhere.
 */

interface ElementWithProps extends ReactElement {
  props: {
    children?: React.ReactNode;
    className?: string;
    [key: string]: unknown;
  };
}

function renderBar(props: Parameters<typeof ProgressBar>[0]): ElementWithProps {
  return ProgressBar(props) as unknown as ElementWithProps;
}

function rootProps(props: Parameters<typeof ProgressBar>[0]): Record<string, unknown> {
  return renderBar(props).props;
}

/**
 * The visual chrome is shared through a fragment, so descend one level to count
 * the real parts (track, optional label) rather than the single fragment node.
 */
function barParts(props: Parameters<typeof ProgressBar>[0]): ReactElement[] {
  const fragment = renderBar(props).props.children as ElementWithProps;
  return Children.toArray(fragment.props.children) as ReactElement[];
}

describe("ProgressBar", () => {
  it("exposes a progressbar widget with its value by default", () => {
    const props = rootProps({ value: 42 });

    expect(props.role).toBe("progressbar");
    expect(props["aria-valuenow"]).toBe(42);
    expect(props["aria-valuemin"]).toBe(0);
    expect(props["aria-valuemax"]).toBe(100);
    expect(props["aria-hidden"]).toBeUndefined();
  });

  it("clamps the reported value to 0–100", () => {
    expect(rootProps({ value: -10 })["aria-valuenow"]).toBe(0);
    expect(rootProps({ value: 999 })["aria-valuenow"]).toBe(100);
    expect(rootProps({ value: 55.4 })["aria-valuenow"]).toBe(55);
  });

  /**
   * The core regression: a decorative bar must not also be a widget, because
   * `aria-hidden` and `role="progressbar"` assert opposite things.
   */
  it("drops the widget role when marked decorative, so the ARIA contracts cannot contradict", () => {
    const props = rootProps({ value: 42, "aria-hidden": "true" });

    expect(props["aria-hidden"]).toBe("true");
    expect(props.role).toBeUndefined();
    expect(props["aria-valuenow"]).toBeUndefined();
    expect(props["aria-valuemin"]).toBeUndefined();
    expect(props["aria-valuemax"]).toBeUndefined();
  });

  it("treats the boolean form of aria-hidden as decorative too", () => {
    const props = rootProps({ value: 42, "aria-hidden": true });

    expect(props.role).toBeUndefined();
    expect(props["aria-valuenow"]).toBeUndefined();
  });

  it("keeps the visual chrome identical in both forms", () => {
    const exposed = renderBar({ value: 30, label: "30%" });
    const decorative = renderBar({ value: 30, "aria-hidden": "true", label: "30%" });

    // Same className and same children shape: only the ARIA contract differs.
    expect(decorative.props.className).toBe(exposed.props.className);

    // `Children.toArray` drops the `false` produced by `label != null && …`.
    const decorativeParts = barParts({ value: 30, "aria-hidden": "true", label: "30%" });
    const exposedParts = barParts({ value: 30, label: "30%" });
    expect(decorativeParts).toHaveLength(2);
    expect(decorativeParts).toHaveLength(exposedParts.length);
  });

  it("renders only the track when no label is supplied", () => {
    expect(barParts({ value: 10 })).toHaveLength(1);
  });

  it("forwards unrelated DOM props in the exposed form", () => {
    const props = rootProps({ value: 10, "data-testid": "bar", id: "progress-1" });
    expect(props["data-testid"]).toBe("bar");
    expect(props.id).toBe("progress-1");
  });

  it("still forwards unrelated DOM props when decorative", () => {
    const props = rootProps({ value: 10, "aria-hidden": "true", "data-testid": "bar" });
    expect(props["data-testid"]).toBe("bar");
    expect(props.role).toBeUndefined();
  });
});
