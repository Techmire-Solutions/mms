import React from "react";
import { X, Mail, Phone, Camera } from "lucide-react";
import { type Contact, getDisplayName, getPrimaryPhone, getPrimaryEmail } from "@mms/shared";
import { cn } from "@/lib/utils";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18n";
import { getGenderBadgeTone } from "@/lib/ui/genderUi";
import { FORM_LABEL } from "@/components/ui/formStyles";
import { RequiredMark } from "@/components/app/FormField";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/app/UserAvatar";
import { GenderIcon } from "@/components/app/GenderIcon";

export interface ContactPickerSelectedProps {
  selected: Contact;
  label: string;
  required?: boolean;
  value: string | number | null;
  resolvedId: string;
  resolvedName: string;
  avatarInputId: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAvatarChange?: (avatarUrl: string) => void;
  onClear: () => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ContactPickerSelected({
  selected,
  label,
  required = false,
  value,
  resolvedId,
  resolvedName,
  avatarInputId,
  fileInputRef,
  onAvatarChange,
  onClear,
  onFileChange,
}: ContactPickerSelectedProps): React.JSX.Element {
  const { t } = useTranslation();
  const selectedPhone = getPrimaryPhone(selected);
  const selectedEmail = getPrimaryEmail(selected);
  const selectedName = getDisplayName(selected);

  const handleAvatarKeyDown = (e: React.KeyboardEvent) => {
    if (onAvatarChange && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="relative">
      <label htmlFor={resolvedId} className={FORM_LABEL}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <div className="group relative flex items-center gap-3.5 p-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 shadow-sm hover:shadow-md transition-all duration-200">
        <div
          onClick={() => onAvatarChange && fileInputRef.current?.click()}
          onKeyDown={handleAvatarKeyDown}
          role={onAvatarChange ? "button" : undefined}
          tabIndex={onAvatarChange ? 0 : undefined}
          aria-label={onAvatarChange ? t("account.changePhoto") : undefined}
          className={cn(
            "w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-muted border border-border flex items-center justify-center shadow-sm relative focus:outline-none focus:ring-2 focus:ring-primary/40",
            onAvatarChange && "cursor-pointer group/avatar",
          )}
        >
          <UserAvatar
            id={selected.id}
            name={selectedName}
            avatar={selected.avatar}
            gender={selected.gender}
            className="w-full h-full text-sm"
          />
          {onAvatarChange && (
            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity duration-150">
              <Camera className="w-4 h-4 text-white" aria-hidden />
            </div>
          )}
          <input
            id={avatarInputId}
            name={`${resolvedName}-avatar`}
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
            aria-label={t("account.changePhoto")}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <p className="min-w-0 truncate text-sm font-bold text-foreground" title={selectedName}>
              {selectedName}
            </p>
            {selected.gender && (
              <Badge
                as="span"
                tone={getGenderBadgeTone(selected.gender)}
                className="gap-1 px-2 capitalize rounded-md text-xs"
              >
                <GenderIcon gender={selected.gender} className="w-3 h-3 inline shrink-0" />
                {formatContactGenderLabel(selected.gender, t)}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {selectedPhone && (
              <span className="flex items-center gap-1" title={selectedPhone}>
                <Phone className="w-3 h-3 text-muted-foreground/60 shrink-0" aria-hidden />
                <span className="truncate">{selectedPhone}</span>
              </span>
            )}
            {selectedEmail && (
              <span className="flex items-center gap-1" title={selectedEmail}>
                <Mail className="w-3 h-3 text-muted-foreground/60 shrink-0" aria-hidden />
                <span className="truncate">{selectedEmail}</span>
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClear}
          aria-label={t("common.dismiss")}
          className="rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/20 shadow-none shrink-0"
        >
          <X className="w-4 h-4" aria-hidden />
        </Button>
      </div>
      <input type="hidden" id={resolvedId} name={resolvedName} value={value ?? ""} />
    </div>
  );
}
