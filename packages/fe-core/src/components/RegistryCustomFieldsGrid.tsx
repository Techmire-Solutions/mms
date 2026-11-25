import type React from "react";
import type { FieldDefinition } from "@mms/contracts";
import { RegistryCustomFieldControl } from "./RegistryCustomFieldControl.js";

export interface RegistryCustomFieldsGridProps {
  fields: readonly FieldDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
  idPrefix?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Renders every enabled registry custom field as a two-column form grid.
 * Callers pass the already-filtered module field list (`listEnabledCustom*FormFields`).
 */
export function RegistryCustomFieldsGrid({
  fields,
  values,
  onChange,
  errors = {},
  idPrefix = "registry-field",
  disabled = false,
  className = "grid grid-cols-1 gap-4 md:grid-cols-2",
}: RegistryCustomFieldsGridProps): React.JSX.Element | null {
  const enabled = fields.filter((field) => field.enabled !== false);
  if (enabled.length === 0) return null;

  return (
    <div className={className}>
      {enabled.map((field) => (
        <RegistryCustomFieldControl
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(value) => onChange(field.key, value)}
          error={errors[field.key] ?? errors[`custom:${field.key}`]}
          idPrefix={idPrefix}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
