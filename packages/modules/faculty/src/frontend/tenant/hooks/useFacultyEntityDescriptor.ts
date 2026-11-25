import type { Faculty } from "@mms/contracts";
import type {
  EntityDescriptor,
  FieldBadgeConfig,
} from "@mms/fe-core/components/entityRegistryTypes";
import { facultyEntityDescriptor } from "../lib/facultyDescriptors";
import { useStaticEntityDescriptor } from "@mms/fe-core/components/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";
import { formatContactGenderLabel } from "@mms/fe-core/lib/contactI18n";
import { facultyStatusBadgeConfig } from "../lib/facultyStatusUi";
import { SEMANTIC_BADGE } from "@mms/fe-core/ui/semanticTone";
import { useMemo } from "react";

/**
 * Returns an i18n-resolved EntityDescriptor<Faculty> with filter-chip badge maps.
 */
export function useFacultyEntityDescriptor(): EntityDescriptor<Faculty> {
  const { t } = useTranslation();
  const base = useStaticEntityDescriptor(
    facultyEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );

  return useMemo(() => {
    const statusMap = facultyStatusBadgeConfig(t);
    const statusBadgeVariantMap: Record<string, FieldBadgeConfig> = {};
    for (const [status, item] of Object.entries(statusMap)) {
      statusBadgeVariantMap[status] = {
        label: item.label,
        className: item.cls,
      };
    }

    const fields = base.fields.map((field) => {
      if (field.key === "status") {
        return { ...field, filterable: true, badgeVariantMap: statusBadgeVariantMap };
      }
      if (field.key === "gender") {
        return {
          ...field,
          filterable: true,
          badgeVariantMap: {
            male: {
              label: formatContactGenderLabel("male", t),
              tone: "info" as const,
              className: SEMANTIC_BADGE.info,
            },
            female: {
              label: formatContactGenderLabel("female", t),
              tone: "secondary" as const,
              className: SEMANTIC_BADGE.secondary,
            },
          },
        };
      }
      return field;
    });

    return { ...base, fields };
  }, [base, t]);
}
