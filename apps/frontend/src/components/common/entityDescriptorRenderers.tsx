import React, { type ReactNode } from "react";
import { formatMoney } from "@mms/shared";
import { StatusBadge } from "@/components/app/StatusBadge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { FieldDefinition } from "@/components/common/entityRegistryTypes";

export function formatFieldValueDefault<T>(
  field: FieldDefinition<T> | undefined,
  rawValue: unknown,
  entity: T,
): string {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return "—";
  }

  if (field?.formatValue) {
    return field.formatValue(rawValue, entity);
  }

  switch (field?.type) {
    case "currency":
      return typeof rawValue === "number" || typeof rawValue === "string"
        ? formatMoney(rawValue, field.currencyCode ?? "USD")
        : String(rawValue);
    case "boolean":
      return rawValue ? "Yes" : "No";
    case "date":
    case "datetime":
      return String(rawValue).slice(0, 10);
    case "badge":
    case "status": {
      const strVal = String(rawValue);
      return field.badgeVariantMap?.[strVal]?.label ?? strVal;
    }
    default:
      return String(rawValue);
  }
}

export function renderFieldValueDefault<T>(
  field: FieldDefinition<T> | undefined,
  rawValue: unknown,
  entity: T,
  fieldKey: string,
  formattedFallback: string,
): ReactNode {
  if (field?.renderValue) {
    return field.renderValue(entity);
  }

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  const aria = field?.ariaLabel
    ? typeof field.ariaLabel === "function"
      ? field.ariaLabel(rawValue, entity)
      : field.ariaLabel
    : undefined;

  if (field?.type === "badge" || field?.type === "status") {
    const strVal = String(rawValue);
    const customConfig = field.badgeVariantMap?.[strVal];
    if (customConfig?.className) {
      if (
        process.env.NODE_ENV === "development" &&
        !(Object.values(SEMANTIC_BADGE) as readonly string[]).includes(customConfig.className)
      ) {
        console.warn(
          `[entityDescriptorFactory] Badge className for field '${fieldKey}' value '${strVal}' does not match any SEMANTIC_BADGE token.`,
        );
      }
      return (
        <span
          aria-label={aria}
          className={`inline-flex items-center gap-1 font-bold rounded-md border text-xs px-2 py-0.5 ${customConfig.className}`}
        >
          {customConfig.label ?? strVal}
        </span>
      );
    }
    return <StatusBadge status={strVal} aria-label={aria} />;
  }

  if (field?.type === "phone" && typeof rawValue === "string") {
    return (
      <a
        href={`tel:${rawValue}`}
        aria-label={aria}
        className="text-primary hover:underline underline-offset-2 transition-colors"
      >
        {rawValue}
      </a>
    );
  }

  if (field?.type === "email" && typeof rawValue === "string") {
    return (
      <a
        href={`mailto:${rawValue}`}
        aria-label={aria}
        className="text-primary hover:underline underline-offset-2 transition-colors"
      >
        {rawValue}
      </a>
    );
  }

  return <span aria-label={aria}>{formattedFallback}</span>;
}
