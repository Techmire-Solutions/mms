import React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  BRANDING_SOCIAL_PLATFORM_DEFS,
  BRANDING_SOCIAL_PLACEHOLDERS,
  type AppTranslationKey,
  type BrandingSocialLink,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/FormSelect";

interface SocialLinksEditorProps {
  links: BrandingSocialLink[];
  onChange: (links: BrandingSocialLink[]) => void;
}

export function SocialLinksEditor({ links, onChange }: SocialLinksEditorProps): React.JSX.Element {
  const { t } = useTranslation();

  const linkEntries =
    links.length > 0 ? links : [{ platform: BRANDING_SOCIAL_PLATFORM_DEFS[0].id, url: "" }];

  const addLink = (): void => {
    onChange([...linkEntries, { platform: BRANDING_SOCIAL_PLATFORM_DEFS[0].id, url: "" }]);
  };

  const updateLink = (index: number, patch: Partial<BrandingSocialLink>): void => {
    onChange(linkEntries.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  };

  const removeLink = (index: number): void => {
    onChange(linkEntries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {linkEntries.map((link, index) => (
          <div
            key={`${link.platform}-${index}`}
            className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor={`social-platform-${index}`}>{t("branding.socialPlatform")}</Label>
              <FormSelect
                id={`social-platform-${index}`}
                value={link.platform}
                onChange={(platform) => updateLink(index, { platform })}
                options={BRANDING_SOCIAL_PLATFORM_DEFS.map((def) => ({
                  value: def.id,
                  label: t(def.labelKey as AppTranslationKey),
                }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor={`social-url-${index}`}>{t("branding.socialUrl")}</Label>
                <Input
                  id={`social-url-${index}`}
                  type="text"
                  inputMode={link.platform === "WhatsApp" ? "tel" : "url"}
                  value={link.url}
                  placeholder={BRANDING_SOCIAL_PLACEHOLDERS[link.platform] ?? "https://"}
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("branding.socialRemoveAria")}
                onClick={() => removeLink(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addLink}>
        <Plus className="h-4 w-4" />
        {t("branding.socialAdd")}
      </Button>
    </div>
  );
}
