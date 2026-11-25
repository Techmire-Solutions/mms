import { useMemo } from "react";
import type {
  EntityDescriptor,
  FieldDefinition,
} from "@mms/fe-core/components/entityRegistryTypes";
import { createEntityDescriptor } from "@mms/fe-core/components/entityDescriptorFactory";
import type { CreateEntityDescriptorOptions } from "@mms/fe-core/components/entityRegistryTypes";

export type StaticDescriptorInput<T> = Omit<CreateEntityDescriptorOptions<T>, "fields"> & {
  fields: (FieldDefinition<T> & { labelKey?: string })[];
};

/**
 * Generic hook factory that builds an EntityDescriptor<T> from a static field
 * config, resolving each field's display label at call time via the provided
 * `resolveLabel` function (typically `(key, fallback) => t(key) ?? fallback`).
 *
 * This is the canonical SSOT hook pattern for modules that do not have a runtime
 * FieldConfig registry (i.e. every module except Contacts which uses
 * `createEntityDescriptorFromFieldConfig`).
 *
 * Usage:
 *   ```ts
 *   const descriptor = useStaticEntityDescriptor(studentsBaseConfig, (key, fallback) =>
 *     t(key as TranslationKey) || fallback,
 *   );
 *   ```
 */
export function useStaticEntityDescriptor<T>(
  /** Static base config — should be a module-level constant (stable reference). */
  baseConfig: StaticDescriptorInput<T>,
  /** Label resolver called once per field; receives (labelKey | field.key, field.label). */
  resolveLabel: (key: string, fallback: string) => string,
): EntityDescriptor<T> {
  return useMemo(() => {
    const i18nFields = baseConfig.fields.map((field) => ({
      ...field,
      label: resolveLabel(field.labelKey ?? field.key, field.label),
    }));
    return createEntityDescriptor<T>({
      ...baseConfig,
      fields: i18nFields,
    });
  }, [baseConfig, resolveLabel]);
}
