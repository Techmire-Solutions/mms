import { snap, type AlignmentType, type BoundingBox } from "./templateEditorBasicUtils";

export function alignElements<T extends BoundingBox & { id: string }>(
  elements: T[],
  selectedIds: string[],
  alignType: AlignmentType,
): T[] {
  if (selectedIds.length < 2) return elements;
  const idSet = new Set(selectedIds);
  const targets = elements.filter((el) => idSet.has(el.id));
  if (targets.length < 2) return elements;

  let targetVal: number;
  switch (alignType) {
    case "left":
      targetVal = Math.min(...targets.map((el) => el.x));
      break;
    case "right":
      targetVal = Math.max(...targets.map((el) => el.x + (el.w || 0)));
      break;
    case "top":
      targetVal = Math.min(...targets.map((el) => el.y));
      break;
    case "bottom":
      targetVal = Math.max(...targets.map((el) => el.y + (el.h || 0)));
      break;
    case "centerH": {
      const minX = Math.min(...targets.map((el) => el.x));
      const maxX = Math.max(...targets.map((el) => el.x + (el.w || 0)));
      targetVal = minX + (maxX - minX) / 2;
      break;
    }
    case "centerV": {
      const minY = Math.min(...targets.map((el) => el.y));
      const maxY = Math.max(...targets.map((el) => el.y + (el.h || 0)));
      targetVal = minY + (maxY - minY) / 2;
      break;
    }
  }

  return elements.map((el) => {
    if (!idSet.has(el.id)) return el;
    switch (alignType) {
      case "left":
        return { ...el, x: snap(Math.max(0, targetVal)) };
      case "right":
        return { ...el, x: snap(Math.max(0, targetVal - (el.w || 0))) };
      case "top":
        return { ...el, y: snap(Math.max(0, targetVal)) };
      case "bottom":
        return { ...el, y: snap(Math.max(0, targetVal - (el.h || 0))) };
      case "centerH":
        return { ...el, x: snap(Math.max(0, targetVal - (el.w || 0) / 2)) };
      case "centerV":
        return { ...el, y: snap(Math.max(0, targetVal - (el.h || 0) / 2)) };
    }
  });
}

export function centerElementOnPage<T extends BoundingBox>(
  element: T,
  pageWidth: number,
  pageHeight: number,
  axis: "both" | "h" | "v" = "both",
): T {
  const newX = axis === "v" ? element.x : snap(Math.max(0, (pageWidth - element.w) / 2));
  const newY = axis === "h" ? element.y : snap(Math.max(0, (pageHeight - element.h) / 2));
  return {
    ...element,
    x: newX,
    y: newY,
  };
}

export function distributeElements<T extends BoundingBox & { id: string }>(
  elements: T[],
  selectedIds: string[],
  axis: "horizontal" | "vertical",
): T[] {
  if (selectedIds.length < 3) return elements;
  const idSet = new Set(selectedIds);
  const targets = elements.filter((el) => idSet.has(el.id));
  if (targets.length < 3) return elements;

  if (axis === "horizontal") {
    const sorted = [...targets].sort((a, b) => a.x - b.x);
    const minX = sorted[0]!.x;
    const last = sorted[sorted.length - 1]!;
    const maxX = last.x + (last.w || 0);
    const totalElementWidth = sorted.reduce((sum, el) => sum + (el.w || 0), 0);
    const availableGap = Math.max(0, maxX - minX - totalElementWidth);
    const gap = sorted.length > 1 ? availableGap / (sorted.length - 1) : 0;

    let currentX = minX;
    const posMap = new Map<string, number>();
    for (const el of sorted) {
      posMap.set(el.id, snap(currentX));
      currentX += (el.w || 0) + gap;
    }
    return elements.map((el) => {
      const newX = posMap.get(el.id);
      return newX !== undefined ? { ...el, x: newX } : el;
    });
  } else {
    const sorted = [...targets].sort((a, b) => a.y - b.y);
    const minY = sorted[0]!.y;
    const last = sorted[sorted.length - 1]!;
    const maxY = last.y + (last.h || 0);
    const totalElementHeight = sorted.reduce((sum, el) => sum + (el.h || 0), 0);
    const availableGap = Math.max(0, maxY - minY - totalElementHeight);
    const gap = sorted.length > 1 ? availableGap / (sorted.length - 1) : 0;

    let currentY = minY;
    const posMap = new Map<string, number>();
    for (const el of sorted) {
      posMap.set(el.id, snap(currentY));
      currentY += (el.h || 0) + gap;
    }
    return elements.map((el) => {
      const newY = posMap.get(el.id);
      return newY !== undefined ? { ...el, y: newY } : el;
    });
  }
}

export function bringSelectedToFront<T extends { id: string }>(
  elements: T[],
  selectedIds: string[],
): T[] {
  if (selectedIds.length === 0) return elements;
  const idSet = new Set(selectedIds);
  const unselected = elements.filter((el) => !idSet.has(el.id));
  const selected = elements.filter((el) => idSet.has(el.id));
  return [...unselected, ...selected];
}

export function sendSelectedToBack<T extends { id: string }>(
  elements: T[],
  selectedIds: string[],
): T[] {
  if (selectedIds.length === 0) return elements;
  const idSet = new Set(selectedIds);
  const unselected = elements.filter((el) => !idSet.has(el.id));
  const selected = elements.filter((el) => idSet.has(el.id));
  return [...selected, ...unselected];
}
