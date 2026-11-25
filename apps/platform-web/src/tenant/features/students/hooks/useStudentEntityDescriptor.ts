import { useMemo } from "react";
import type { Student } from "@mms/contracts";
import type {
  EntityDescriptor,
  FieldBadgeConfig,
} from "@mms/fe-core/components/entityRegistryTypes";
import { studentsEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";
import { formatContactGenderLabel } from "@mms/fe-core/lib/contactI18n";
import { studentStatusBadgeConfig } from "@/lib/students/studentStatusUi";
import { SEMANTIC_BADGE } from "@mms/fe-core/ui/semanticTone";

/**
 * Returns an i18n-resolved EntityDescriptor<Student> with filter-chip badge maps.
 */
export function useStudentEntityDescriptor(): EntityDescriptor<Student> {
  const { t } = useTranslation();
  const base = useStaticEntityDescriptor(
    studentsEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );

  return useMemo(() => {
    const statusMap = studentStatusBadgeConfig(t);
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
