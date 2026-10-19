import React, {
  useState,
  useMemo,
  useCallback,
  Suspense,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Camera, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type Contact,
  getDisplayName,
  getInitials,
  IMAGE_UPLOAD_MAX_INPUT_BYTES,
} from "@mms/shared";
import { ContactIdentityMeta } from "@/tenant/features/contacts/components/ContactIdentityMeta";
import { genderAvatarGradient } from "@/lib/ui/semanticTone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const AvatarCropper = React.lazy(() =>
  import("@/components/app/AvatarCropper").then((m) => ({ default: m.AvatarCropper })),
);

export interface ContactBasicAvatarSectionProps {
  contactDraft: Partial<Contact>;
  formInstanceId: string;
  cropSrc: string | null;
  setCropSrc: (src: string | null) => void;
  updateDraft: (patch: Partial<Contact>) => void;
  handleAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function ContactBasicAvatarSection({
  contactDraft,
  formInstanceId,
  cropSrc,
  setCropSrc,
  updateDraft,
  handleAvatarChange,
}: ContactBasicAvatarSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const avatarInputId = `cf-${formInstanceId}-avatar-file`;
  const previewDisplayName = useMemo(
    () => getDisplayName(contactDraft) || t("contacts.form.draftHeading"),
    [contactDraft, t],
  );
  const avatarGradient = genderAvatarGradient(contactDraft.gender || "neutral");
  const initials = useMemo(() => getInitials(previewDisplayName, 2) || "?", [previewDisplayName]);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        notify.error(t("account.photoUploadFailed"));
        return;
      }

      if (file.size > IMAGE_UPLOAD_MAX_INPUT_BYTES) {
        notify.error(t("contacts.form.avatarTooLarge"));
        return;
      }

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        if (typeof readerEvent.target?.result === "string") {
          setCropSrc(readerEvent.target.result);
        }
      };
      reader.onerror = () => {
        notify.error(t("account.photoUploadFailed"));
      };
      reader.readAsDataURL(file);
    },
    [setCropSrc, t],
  );

  return (
    <div className="mb-2 flex flex-col items-center gap-6 border-b border-border/60 pb-6 @sm:flex-row">
      {cropSrc && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
              <Skeleton className="w-full max-w-md h-96 rounded-2xl" />
            </div>
          }
        >
          <AvatarCropper
            src={cropSrc}
            onCrop={(url) => {
              updateDraft({ avatar: url });
              setCropSrc(null);
            }}
            onCancel={() => setCropSrc(null)}
          />
        </Suspense>
      )}
      <div
        className="relative flex-shrink-0 group"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-primary/30 via-accent/30 to-secondary/30 group-hover:from-primary/60 group-hover:via-accent/60 group-hover:to-secondary/60 blur-subtle transition-all duration-500 opacity-75 group-hover:opacity-100" />
        <div
          className={cn(
            "relative w-20 h-20 rounded-2xl bg-card overflow-hidden flex items-center justify-center border-2 border-border/80 shadow-surface transition-all duration-300 group-hover:scale-105",
            isDragging && "ring-2 ring-primary border-primary scale-105",
          )}
        >
          {contactDraft.avatar ? (
            <img
              src={contactDraft.avatar}
              alt={previewDisplayName}
              width={80}
              height={80}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={cn(
                "w-full h-full flex items-center justify-center font-extrabold text-2xl text-white bg-gradient-to-br select-none",
                avatarGradient,
              )}
            >
              {initials}
            </div>
          )}

          <label
            htmlFor={avatarInputId}
            className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-foreground/40 text-white opacity-0 group-hover:opacity-100 focus-within:opacity-100 backdrop-blur-subtle transition-opacity duration-300"
          >
            <Camera
              className="h-6 w-6 scale-90 transition-transform duration-300 group-hover:scale-100"
              aria-hidden
            />
            <input
              id={avatarInputId}
              name="avatarFile"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
              aria-label={t("account.changePhoto")}
            />
          </label>
        </div>

        {/* Change Photo Badge */}
        <label
          htmlFor={avatarInputId}
          className="absolute -bottom-1 -end-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md border-2 border-card hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-transform before:absolute before:-inset-2 before:content-['']"
          title={t("account.changePhoto")}
        >
          <span className="sr-only">{t("account.changePhoto")}</span>
          <Camera className="h-3.5 w-3.5" aria-hidden />
        </label>

        {/* Remove Photo Action */}
        {contactDraft.avatar ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => updateDraft({ avatar: null })}
            className="absolute -top-1.5 -end-1.5 h-6 w-6 rounded-lg shadow-md border-2 border-card p-0 hover:scale-110 before:absolute before:-inset-2.5 before:content-[''] transition-transform cursor-pointer"
            aria-label={t("contacts.form.removePhoto")}
            title={t("contacts.form.removePhoto")}
          >
            <X className="h-3 w-3" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 text-center @sm:text-start">
        <h3 className="truncate text-base font-bold text-foreground">{previewDisplayName}</h3>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 @sm:justify-start">
          <ContactIdentityMeta
            gender={contactDraft.gender}
            isSyed={contactDraft.isSyed}
            size="md"
          />
        </div>
      </div>
    </div>
  );
}
