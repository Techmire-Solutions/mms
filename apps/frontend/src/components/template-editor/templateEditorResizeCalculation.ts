import type { PageSizeInfo, TemplateElement } from "@mms/shared";
import { snap } from "./templateEditorUtils";
import type { ResizeHandle, ResizeStateInfo } from "./templateEditorInteractionTypes";

export function computeResizedElement<TPayload = Record<string, unknown>>(
  templateElement: TemplateElement<keyof TPayload & string>,
  currentResize: ResizeStateInfo<TPayload>,
  deltaX: number,
  deltaY: number,
  size: PageSizeInfo,
  shiftKey: boolean,
): TemplateElement<keyof TPayload & string> {
  if (templateElement.id !== currentResize.id) return templateElement;

  let newX = currentResize.origX;
  let newY = currentResize.origY;
  let newW = currentResize.origW;
  let newH = currentResize.origH;

  const hType: ResizeHandle = currentResize.handle || "se";
  const isCorner = ["nw", "ne", "sw", "se"].includes(hType);
  const keepRatio = shiftKey && isCorner && currentResize.origH > 0;
  const ratio = currentResize.origW / currentResize.origH;

  if (hType === "e" || hType === "ne" || hType === "se") {
    const maxW = Math.max(20, size.width - currentResize.origX);
    newW = Math.min(maxW, Math.max(20, currentResize.origW + deltaX));
  } else if (hType === "w" || hType === "nw" || hType === "sw") {
    const maxW = currentResize.origX + currentResize.origW;
    newW = Math.min(maxW, Math.max(20, currentResize.origW - deltaX));
    newX = currentResize.origX + (currentResize.origW - newW);
  }

  if (hType === "s" || hType === "se" || hType === "sw") {
    const maxH = Math.max(4, size.height - currentResize.origY);
    newH = Math.min(maxH, Math.max(4, currentResize.origH + deltaY));
  } else if (hType === "n" || hType === "ne" || hType === "nw") {
    const maxH = currentResize.origY + currentResize.origH;
    newH = Math.min(maxH, Math.max(4, currentResize.origH - deltaY));
    newY = currentResize.origY + (currentResize.origH - newH);
  }

  if (keepRatio) {
    newH = Math.max(4, newW / ratio);
    if (hType === "ne" || hType === "nw") {
      newY = currentResize.origY + (currentResize.origH - newH);
    }
  }

  return {
    ...templateElement,
    x: snap(Math.max(0, newX)),
    y: snap(Math.max(0, newY)),
    w: snap(newW),
    h: snap(newH),
  };
}
