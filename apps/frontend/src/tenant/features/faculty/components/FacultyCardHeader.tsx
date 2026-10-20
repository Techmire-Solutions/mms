import type { Faculty } from "@mms/shared";
import { Badge } from "@/components/ui/badge";
import {
  DirectoryCardSubtitleStack,
  PersonIdentityMeta,
} from "@/components/app/PersonIdentityMeta";
import { useTranslation } from "@/hooks/useTranslation";
import { EntityCard } from "@/components/app/EntityCard";

export interface FacultyCardHeaderProps {
  faculty: Faculty;
  facultyId: string;
  isSelected: boolean;
  displayName: string;
  /** Column-visibility gate — employees show employee id / gender like Students gates GR/gender on cards. */
  isColumnVisible?: (key: string) => boolean;
  onSelectOne: (id: string) => void;
  onView: (faculty: Faculty) => void;
  reducedMotion?: boolean;
}

/** Contacts-shaped horizontal card header: checkbox | avatar + name + employee id. */
export function FacultyCardHeader({
  faculty,
  facultyId,
  isSelected,
  displayName,
  isColumnVisible,
  onSelectOne,
  onView,
  reducedMotion = false,
}: FacultyCardHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  const showEmployeeId =
    (!isColumnVisible || isColumnVisible("employeeId")) && Boolean(faculty.employeeId);
  const showGender = (!isColumnVisible || isColumnVisible("gender")) && Boolean(faculty.gender);
  const effectiveGender = showGender ? faculty.gender : undefined;

  const hasSubtitle = showEmployeeId || showGender || Boolean(faculty.designation);
  const subtitle = hasSubtitle ? (
    <DirectoryCardSubtitleStack>
      <div className="flex items-center gap-1.5 flex-wrap">
        {showEmployeeId && faculty.employeeId ? (
          <Badge
            as="span"
            size="sm"
            tone="muted"
            className="mt-1 max-w-full px-1.5 py-0.5 rounded font-bold tracking-tight truncate self-start"
            title={faculty.employeeId}
          >
            {faculty.employeeId}
          </Badge>
        ) : null}
        {faculty.designation ? (
          <span
            title={faculty.designation}
            className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-semibold bg-primary/10 text-primary border border-primary/20 truncate"
          >
            {faculty.designation}
          </span>
        ) : null}
      </div>
      {showGender && faculty.gender ? (
        <PersonIdentityMeta gender={faculty.gender} className="font-semibold truncate" />
      ) : null}
    </DirectoryCardSubtitleStack>
  ) : undefined;

  return (
    <EntityCard.Header
      id={facultyId}
      displayName={displayName}
      avatar={faculty.avatar}
      gender={effectiveGender}
      isSelected={isSelected}
      onSelect={() => onSelectOne(facultyId)}
      selectAriaLabel={t("faculty.table.selectFaculty", { name: displayName })}
      onView={() => onView(faculty)}
      viewAriaLabel={`${t("faculty.list.viewDetails")} - ${displayName}`}
      reducedMotion={reducedMotion}
      subtitle={subtitle}
    />
  );
}
