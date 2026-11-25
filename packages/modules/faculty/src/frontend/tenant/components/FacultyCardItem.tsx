import type React from "react";
import { DirectoryEntityCard } from "@mms/fe-core/components/DirectoryEntityCard";
import { getGenderAccentBarClass } from "@mms/ui/app/directoryCardAccent";
import { useTranslation } from "@mms/fe-core/i18n";
import { resolveFacultyPrimaryChannels } from "../lib/facultyPrimaryChannels";
import { FacultyArchivedBanner } from "./FacultyArchivedBanner";
import { FacultyCardActions } from "./FacultyCardActions";
import { FacultyCardHeader } from "./FacultyCardHeader";
import { FacultyCardMetadata } from "./FacultyCardMetadata";
import { resolveFacultyCardFaceVisibility } from "../lib/facultyCardFaceVisibility";
import { facultyRowIdentity } from "../lib/facultyFieldDisplay";
import type { useFacultyEntityDescriptor } from "../hooks/useFacultyEntityDescriptor";
import type { FacultyListContentProps } from "../lib/facultyListContentShared";
import type { Faculty } from "@mms/contracts";

export interface FacultyCardItemProps {
  faculty: Faculty;
  selectedSet: Set<string>;
  selectedIds: string[];
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  isColumnVisible: (key: string) => boolean;
  columnRegistry: FacultyListContentProps["columnRegistry"];
  customFieldsById: FacultyListContentProps["customFieldsById"];
  statusConfig: FacultyListContentProps["statusConfig"];
  descriptor: ReturnType<typeof useFacultyEntityDescriptor>;
  reducedMotion: boolean;
  onSelectOne: (id: string) => void;

  onView: (faculty: Faculty) => void;
  onEdit: (faculty: Faculty) => void;
  onRequestDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onSms?: (faculty: Faculty[]) => void;
  onWhatsApp?: (faculty: Faculty[]) => void;
  onEmail?: (faculty: Faculty[]) => void;
}

export function FacultyCardItem(props: FacultyCardItemProps): React.JSX.Element {
  const faculty = props.faculty;
  const {
    selectedSet,
    selectedIds,
    showDeleted,
    canWrite,
    canDelete,
    isColumnVisible,
    columnRegistry,
    customFieldsById,
    statusConfig,
    descriptor,
    reducedMotion,
    onSelectOne,
    onView,
    onEdit,
    onRequestDelete,
    onRestore,
    onSms,
    onWhatsApp,
    onEmail,
  } = props;
  const { t } = useTranslation();
  const facultyIdStr = String(faculty.id);
  const isSelected = selectedSet.has(facultyIdStr);
  const { displayName } = facultyRowIdentity(faculty, selectedSet, t);
  const { phone, email } = resolveFacultyPrimaryChannels(faculty);
  const faceVisible = resolveFacultyCardFaceVisibility(columnRegistry, isColumnVisible);

  return (
    <DirectoryEntityCard
      entity={faculty}
      selectedIds={selectedIds}
      canSelect={canDelete}
      onToggleSelected={() => onSelectOne(facultyIdStr)}
      onView={onView}
      onEdit={onEdit}
      reducedMotion={reducedMotion}
      accentClassName={
        isColumnVisible("gender") ? getGenderAccentBarClass(isSelected, faculty.gender) : undefined
      }
      header={{
        displayName,
      }}
      headerSlot={
        <FacultyCardHeader
          faculty={faculty}
          facultyId={facultyIdStr}
          isSelected={isSelected}
          displayName={displayName}
          isColumnVisible={faceVisible}
          onSelectOne={() => onSelectOne(facultyIdStr)}
          onView={onView}
          reducedMotion={reducedMotion}
        />
      }
      infoPills={{
        phone,
        phoneDisplay: phone,
        email,
        showPhone: faceVisible("phone"),
        showEmail: faceVisible("email"),
        showArchived: showDeleted,
        onWhatsApp: onWhatsApp ? () => onWhatsApp([faculty]) : undefined,
        onSms: onSms ? () => onSms([faculty]) : undefined,
        onEmail: onEmail ? () => onEmail([faculty]) : undefined,
      }}
      metadataSlot={
        <FacultyCardMetadata
          faculty={faculty}
          isColumnVisible={isColumnVisible}
          columnRegistry={columnRegistry}
          customFieldsById={customFieldsById}
          statusConfig={statusConfig}
          descriptor={descriptor}
        />
      }
      banner={<FacultyArchivedBanner faculty={faculty} />}
      footer={
        <FacultyCardActions
          faculty={faculty}
          facultyId={facultyIdStr}
          displayName={displayName}
          showDeleted={showDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          onView={onView}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
          onRestore={onRestore}
          onSms={onSms}
          onWhatsApp={onWhatsApp}
          onEmail={onEmail}
        />
      }
    />
  );
}
