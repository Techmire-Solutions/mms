/**
 * @file templateSmartGuides.ts
 * @description Smart snapping guides calculation for alignment against canvas elements and page boundaries.
 */

import { snap, type BoundingBox } from "./templateEditorUtils";

export interface SmartGuideLine {
  orientation: "horizontal" | "vertical";
  position: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SmartGuideLine[];
}

export function computeSmartGuides(
  activeBox: BoundingBox,
  otherBoxes: BoundingBox[],
  pageWidth: number,
  pageHeight: number,
  threshold = 5,
): SnapResult {
  let snappedX = activeBox.x;
  let snappedY = activeBox.y;
  const guides: SmartGuideLine[] = [];

  const activeCenterX = activeBox.x + activeBox.w / 2;
  const activeRight = activeBox.x + activeBox.w;

  const activeCenterY = activeBox.y + activeBox.h / 2;
  const activeBottom = activeBox.y + activeBox.h;

  const xTargets = [
    { pos: 0, guide: 0 },
    { pos: pageWidth / 2, guide: pageWidth / 2 },
    { pos: pageWidth, guide: pageWidth },
  ];
  for (const b of otherBoxes) {
    xTargets.push({ pos: b.x, guide: b.x });
    xTargets.push({ pos: b.x + b.w / 2, guide: b.x + b.w / 2 });
    xTargets.push({ pos: b.x + b.w, guide: b.x + b.w });
  }

  let minDeltaX = threshold + 1;
  let chosenXGuide: number | null = null;
  let chosenSnappedX = snappedX;

  for (const t of xTargets) {
    const dLeft = Math.abs(activeBox.x - t.pos);
    if (dLeft < minDeltaX) {
      minDeltaX = dLeft;
      chosenSnappedX = t.pos;
      chosenXGuide = t.guide;
    }
    const dRight = Math.abs(activeRight - t.pos);
    if (dRight < minDeltaX) {
      minDeltaX = dRight;
      chosenSnappedX = t.pos - activeBox.w;
      chosenXGuide = t.guide;
    }
    const dCenter = Math.abs(activeCenterX - t.pos);
    if (dCenter < minDeltaX) {
      minDeltaX = dCenter;
      chosenSnappedX = t.pos - activeBox.w / 2;
      chosenXGuide = t.guide;
    }
  }

  if (minDeltaX <= threshold && chosenXGuide !== null) {
    snappedX = snap(chosenSnappedX);
    guides.push({ orientation: "vertical", position: chosenXGuide });
  }

  const yTargets = [
    { pos: 0, guide: 0 },
    { pos: pageHeight / 2, guide: pageHeight / 2 },
    { pos: pageHeight, guide: pageHeight },
  ];
  for (const b of otherBoxes) {
    yTargets.push({ pos: b.y, guide: b.y });
    yTargets.push({ pos: b.y + b.h / 2, guide: b.y + b.h / 2 });
    yTargets.push({ pos: b.y + b.h, guide: b.y + b.h });
  }

  let minDeltaY = threshold + 1;
  let chosenYGuide: number | null = null;
  let chosenSnappedY = snappedY;

  for (const t of yTargets) {
    const dTop = Math.abs(activeBox.y - t.pos);
    if (dTop < minDeltaY) {
      minDeltaY = dTop;
      chosenSnappedY = t.pos;
      chosenYGuide = t.guide;
    }
    const dBottom = Math.abs(activeBottom - t.pos);
    if (dBottom < minDeltaY) {
      minDeltaY = dBottom;
      chosenSnappedY = t.pos - activeBox.h;
      chosenYGuide = t.guide;
    }
    const dCenter = Math.abs(activeCenterY - t.pos);
    if (dCenter < minDeltaY) {
      minDeltaY = dCenter;
      chosenSnappedY = t.pos - activeBox.h / 2;
      chosenYGuide = t.guide;
    }
  }

  if (minDeltaY <= threshold && chosenYGuide !== null) {
    snappedY = snap(chosenSnappedY);
    guides.push({ orientation: "horizontal", position: chosenYGuide });
  }

  return { x: snappedX, y: snappedY, guides };
}
