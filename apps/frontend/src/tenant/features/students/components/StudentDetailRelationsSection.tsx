import React from "react";
import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import {
  StudentRelationshipCard,
  type StudentRelationshipCardData,
} from "@/tenant/features/students/components/StudentRelationshipCard";

export interface StudentDetailRelationsSectionProps {
  relationships: StudentRelationshipCardData[];
  canMessage?: boolean;
  openComposer?: (channel: "sms" | "whatsapp" | "email", recipients: MessagingRecipient[]) => void;
  onNavigateToContact?: (contactId: string | number) => void;
}

export function StudentDetailRelationsSection({
  relationships,
  canMessage = true,
  openComposer,
  onNavigateToContact,
}: StudentDetailRelationsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (relationships.length === 0) return null;

  return (
    <div className="pt-2">
      <DetailSectionCard
        title={t("students.detail.allRelationships")}
        count={relationships.length}
        accentColor="info"
        className="divide-y divide-border/50 p-0 overflow-hidden"
      >
        {relationships.map((rel) => (
          <StudentRelationshipCard
            key={rel.key}
            relationship={rel}
            canMessage={canMessage}
            openComposer={openComposer}
            onNavigateToContact={onNavigateToContact}
          />
        ))}
      </DetailSectionCard>
    </div>
  );
}
