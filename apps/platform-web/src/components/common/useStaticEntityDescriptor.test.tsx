import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EntityDescriptor, FieldValueType } from "@mms/fe-core/components/entityRegistryTypes";
import {
  useStaticEntityDescriptor,
  type StaticDescriptorInput,
} from "@/components/common/useStaticEntityDescriptor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Payload {
  id: string;
  name: string;
}

const baseConfig: StaticDescriptorInput<Payload> = {
  entityType: "unit-test",
  singularLabel: "Unit",
  pluralLabel: "Units",
  idField: "id",
  titleField: "name",
  fields: [
    { key: "id", label: "ID", type: "text" as FieldValueType, tableOrder: 0 },
    {
      key: "name",
      labelKey: "unit.name",
      label: "Name",
      type: "text" as FieldValueType,
      tableOrder: 1,
    },
  ],
};

describe("useStaticEntityDescriptor", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: EntityDescriptor<Payload>;
  let currentConfig: StaticDescriptorInput<Payload>;
  let currentResolve: (key: string, fallback: string) => string;
  const resolveLabel = vi.fn((key: string, fallback: string) => `${key}→${fallback}`);

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  function Probe(): React.JSX.Element {
    latest = useStaticEntityDescriptor<Payload>(currentConfig, currentResolve);
    return <span data-testid="probe" />;
  }

  function renderDescriptor(options: { strict?: boolean } = {}): void {
    currentConfig = baseConfig;
    currentResolve = resolveLabel;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(options.strict ? <StrictMode>{<Probe />}</StrictMode> : <Probe />);
    });
  }

  function rerender(): void {
    act(() => {
      root.render(<Probe />);
    });
  }

  it("resolves each field label through resolveLabel (labelKey wins, else field key)", () => {
    renderDescriptor();

    expect(latest.getTableColumns().map((column) => column.label)).toEqual([
      "id→ID",
      "unit.name→Name",
    ]);
    expect(resolveLabel).toHaveBeenCalledWith("id", "ID");
    expect(resolveLabel).toHaveBeenCalledWith("unit.name", "Name");
  });

  it("keeps the descriptor referentially stable when the hook re-renders with stable inputs", () => {
    renderDescriptor();

    const first = latest;
    rerender();

    expect(latest).toBe(first);
    // No re-derivation, so resolveLabel is not called again.
    expect(resolveLabel).toHaveBeenCalledTimes(2);
  });

  it("rebuilds the descriptor when the base config reference changes", () => {
    renderDescriptor();

    const first = latest;
    currentConfig = {
      ...baseConfig,
      fields: baseConfig.fields.map((field) => ({ ...field })),
    };
    rerender();

    expect(latest).not.toBe(first);
    expect(latest.getTableColumns().map((column) => column.label)).toEqual([
      "id→ID",
      "unit.name→Name",
    ]);
  });
});
