import React from "react";
import { Mail, User as UserIcon, CheckCircle2 } from "lucide-react";
import { formatDate } from "@mms/shared";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";

export interface PlatformUserProfileInfo {
  email: string;
  createdAt?: string;
  emailVerifiedAt?: string | null;
}

export function PlatformProfileCard({
  profile,
}: {
  profile: PlatformUserProfileInfo;
}): React.JSX.Element {
  const { t } = useTranslation();
  const memberSince = profile.createdAt ? formatDate(profile.createdAt) : null;

  return (
    <SectionCard accentColor="primary" className="text-start">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
          <span className="text-muted-foreground">{t("platform.profileEmail")}</span>
          <span className="font-semibold text-foreground ms-auto truncate max-w-filter-sm">
            {profile.email}
          </span>
        </div>
        {memberSince ? (
          <div className="flex items-center gap-3 text-sm">
            <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
            <span className="text-muted-foreground">{t("platform.profileMemberSince")}</span>
            <span className="font-semibold text-foreground ms-auto">{memberSince}</span>
          </div>
        ) : null}
        {profile.emailVerifiedAt ? (
          <div className="flex items-center gap-2 text-sm text-primary font-bold pt-2 border-t border-border/40">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden />
            <span>{t("platform.profileEmailVerified")}</span>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
