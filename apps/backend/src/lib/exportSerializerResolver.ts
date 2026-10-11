/**
 * @file exportSerializerResolver.ts
 * @description Server-side serializer resolver — ensures all serializers (CSV, JSON, XLSX)
 * are registered before `getSerializer` is called.
 */
import { csvSerializer, jsonSerializer } from "@mms/shared";
import { xlsxSerializer } from "./xlsxExportSerializer.js";

// Explicit references ensure registrations are loaded
void csvSerializer;
void jsonSerializer;
void xlsxSerializer;

export { getSerializer, hasSerializer, registeredFormats } from "@mms/shared";
