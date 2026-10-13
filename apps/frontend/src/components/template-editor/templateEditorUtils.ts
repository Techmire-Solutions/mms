/**
 * @file templateEditorUtils.ts
 * @description Coordinate snapping, unique ID generation, and multi-element alignment utilities.
 */

export * from "./templateEditorBasicUtils";
export * from "./templateEditorAlignment";

export { computeSmartGuides, type SmartGuideLine, type SnapResult } from "./templateSmartGuides";

export { downloadTemplateJson, readTemplateJsonFile } from "./templateJsonIo";
