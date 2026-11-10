import React, { useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebounce } from "@/hooks/useDebounce";
import { useStudentsContractList } from "@/tenant/hooks/collections/students";
import { SearchableSelectField } from "@/components/app/SearchableSelectField";

export interface AttendanceExcuseStudentFieldProps {
  value: string;
  onChange: (studentId: string) => void;
  error?: string;
}

function studentLabel(student: {
  id: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  grNumber?: string;
}): string {
  if (student.name?.trim()) return student.name.trim();
  const full = [student.firstName, student.lastName].filter(Boolean).join(" ").trim();
  return full || student.grNumber?.trim() || String(student.id);
}

/** Remote-search student picker for the excuse form (never a free-text id). */
export function AttendanceExcuseStudentField({
  value,
  onChange,
  error,
}: AttendanceExcuseStudentFieldProps): React.JSX.Element {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const studentsQuery = useStudentsContractList(
    { page: 1, limit: 50, search: debouncedSearch || undefined },
    true,
  );
  const options = useMemo(
    () =>
      (
        (studentsQuery.data?.body?.students ?? []) as Array<{
          id: string | number;
          name?: string;
          firstName?: string;
          lastName?: string;
          grNumber?: string;
        }>
      ).map((student) => ({ value: String(student.id), label: studentLabel(student) })),
    [studentsQuery.data],
  );

  return (
    <SearchableSelectField
      id="attendance-excuse-student"
      name="studentId"
      label={t("attendance.excuses.student")}
      required
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t("attendance.excuses.studentPlaceholder")}
      searchLabel={t("attendance.excuses.studentPlaceholder")}
      searchPlaceholder={t("attendance.excuses.studentPlaceholder")}
      onSearchChange={setSearch}
      isSearching={studentsQuery.isFetching}
      loadingLabel={t("common.loading")}
      isLoading={studentsQuery.isLoading}
      error={error}
    />
  );
}
