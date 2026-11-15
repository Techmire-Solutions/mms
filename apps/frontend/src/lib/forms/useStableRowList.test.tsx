import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useStableRowList } from "./useStableRowList";

type ListApi = ReturnType<typeof useStableRowList<string>>;

function Harness({
  values,
  onChange,
  onReady,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  onReady: (api: ListApi) => void;
}) {
  const api = useStableRowList<string>({
    values,
    onChange,
    createValue: () => "",
    serialize: (next) => next.join("\u0000"),
  });
  onReady(api);
  return (
    <div>
      {api.rows.map((row) => (
        <input key={row.id} data-row-id={row.id} value={row.value} readOnly />
      ))}
    </div>
  );
}

function ids(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-row-id]")).map(
    (element) => element.getAttribute("data-row-id") ?? "",
  );
}

describe("useStableRowList", () => {
  it("keeps row ids through remove, move, update and append", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let api: ListApi | undefined;
    let values = ["A", "B", "C"];
    const onChange = (next: string[]) => {
      values = next;
      render();
    };
    const render = () => {
      root.render(<Harness values={values} onChange={onChange} onReady={(next) => (api = next)} />);
    };

    await act(async () => {
      render();
    });
    const [idA, idB, idC] = ids(container);
    expect([idA, idB, idC].every((id) => id.length === 36)).toBe(true);

    await act(async () => {
      api!.removeAt(1);
    });
    expect(ids(container)).toEqual([idA, idC]);

    await act(async () => {
      api!.move(1, 0);
    });
    expect(ids(container)).toEqual([idC, idA]);

    await act(async () => {
      api!.updateAt(0, () => "C1");
    });
    expect(ids(container)).toEqual([idC, idA]);

    await act(async () => {
      api!.append();
    });
    expect(ids(container).slice(0, 2)).toEqual([idC, idA]);
    expect(ids(container)).toHaveLength(3);

    await act(async () => root.unmount());
    container.remove();
  });

  it("rebuilds row ids when the draft is replaced", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let values = ["A", "B"];
    const render = () => {
      root.render(<Harness values={values} onChange={() => {}} onReady={() => {}} />);
    };

    await act(async () => {
      render();
    });
    const firstIds = ids(container);

    values = ["X", "Y"];
    await act(async () => {
      render();
    });

    expect(ids(container).every((id) => !firstIds.includes(id))).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });
});
