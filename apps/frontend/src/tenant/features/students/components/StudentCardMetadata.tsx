import type { ModuleColumnRegistryEntry, Student } from "@mms/shared";
import { EntityCardMetadata } from "@/components/app/EntityCardMetadata";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { useTranslation } from "@/hooks/useTranslation";
import { getStudentVisibleWorkColumns } from "@/tenant/features/students/lib/studentsListVisibleColumns";
import { renderStudentWorkColumnValue } from "@/tenant/features/students/components/studentWorkColumnCell";

export interface StudentCardMetadataProps {
  student: Student;
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
  isColumnVisible: (key: string) => boolean;
  columnRegistry: ModuleColumnRegistryEntry[];
  /** Optional entity descriptor — when provided, descriptor-driven fields supplement legacy column tiles. */
  descriptor?: EntityDescriptor<Student>;
}

const getColumnKey = (col: { key: string }) => col.key;
const getColumnLabel = (col: { label: string }) => col.label;

/** Students domain metadata tiles — face columns excluded (Contacts/Teachers parity). */
export function StudentCardMetadata({
  student,
  statusBadgeConfig,
  isColumnVisible,
  columnRegistry,
  descriptor,
}: StudentCardMetadataProps): React.JSX.Element | null {
  const { t } = useTranslation();

  const metaColumns = getStudentVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: true,
  });

  if (metaColumns.length === 0 && !descriptor) {
    return null;
  }

  const extraColumns =
    metaColumns.length > 0
      ? {
          columns: metaColumns,
          keyFor: getColumnKey,
          labelFor: getColumnLabel,
          renderValue: (col: ModuleColumnRegistryEntry) =>
            renderStudentWorkColumnValue(student, col.key, {
              t,
              statusBadgeConfig,
              emptyFallback: null,
            }),
        }
      : undefined;

  return (
    <EntityCardMetadata
      descriptor={descriptor}
      entity={student}
      isColumnVisible={isColumnVisible}
      extraColumns={extraColumns}
      columns={extraColumns?.columns}
      keyFor={extraColumns?.keyFor}
      labelFor={extraColumns?.labelFor}
      renderValue={extraColumns?.renderValue}
    />
  );
}
