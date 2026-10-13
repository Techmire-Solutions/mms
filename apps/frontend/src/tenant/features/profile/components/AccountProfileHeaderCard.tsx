import type React from "react";
import type { ChangeEvent, RefObject } from "react";
import { Camera } from "lucide-react";
import { getInitials, type TenantUserProfile } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useTranslation } from "@/hooks/useTranslation";

interface AccountProfileHeaderCardProps {
  profile: TenantUserProfile;
  name: string;
  completeness: number;
  avatarGradient: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function AccountProfileHeaderCard({
  profile,
  name,
  completeness,
  avatarGradient,
  fileInputRef,
  onFileChange,
}: AccountProfileHeaderCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card className="bg-gradient-to-r from-card via-card/90 to-background/50">
      <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 justify-between">
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-start">
          <div className="relative group/avatar">
            <input
              id="profile-avatar-upload"
              name="avatar"
              type="file"
              ref={fileInputRef}
              onChange={onFileChange}
              accept="image/*"
              className="hidden"
              aria-label={t("account.changePhoto")}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => profile.contact && fileInputRef.current?.click()}
              disabled={!profile.contact}
              className={`w-24 h-24 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-extrabold text-2xl shadow-md border-4 border-card relative overflow-hidden p-0 hover:bg-transparent ${profile.contact ? "cursor-pointer group" : ""}`}
              aria-label={t("account.changePhoto")}
            >
              {profile.contact?.avatar ? (
                <img
                  src={profile.contact.avatar}
                  alt={name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <span>
                  {profile.contact?.name
                    ? getInitials(profile.contact.name)
                    : getInitials(profile.name || "U")}
                </span>
              )}

              {profile.contact && (
                <div className="absolute inset-0 bg-foreground/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 flex items-center justify-center transition-all duration-300 rounded-full backdrop-blur-subtle">
                  <Camera className="w-6 h-6 text-white transform scale-90 group-hover:scale-100 transition-transform duration-300" />
                </div>
              )}
            </Button>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {name || profile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
              <Badge pill tone="primary" className="capitalize">
                {profile.role}
              </Badge>
              <span className="text-xs text-muted-foreground">{profile.loginEmail}</span>
            </div>
          </div>
        </div>

        {profile.contact && (
          <div className="w-full md:w-64 space-y-2 text-start">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">{t("account.completeness")}</span>
              <span className="text-primary">{completeness}%</span>
            </div>
            <ProgressBar
              value={completeness}
              size="md"
              fillClassName="bg-gradient-to-r from-primary to-info duration-500 ease-out"
              aria-hidden="true"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
