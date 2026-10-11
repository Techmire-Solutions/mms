import React from "react";
import { Building2, Mail, MapPin, Phone } from "lucide-react";
import { formatBrandingAddress, type BrandingSettings } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { WORK_SURFACE } from "@/components/ui/formStyles";

interface BrandingIdentityPreviewProps {
  data: BrandingSettings;
}

/**
 * Live card preview for institution identity fields.
 */
export default function BrandingIdentityPreview({
  data,
}: BrandingIdentityPreviewProps): React.JSX.Element {
  const { t } = useTranslation();
  const formattedAddress = formatBrandingAddress(data);
  const hasContact = Boolean(data.email || data.phone || data.website);

  return (
    <div className={`${WORK_SURFACE} overflow-hidden`}>
      <div className="flex items-start gap-4 border-b border-border bg-muted/30 px-5 py-4">
        {data.logoUrl ? (
          <img
            src={data.logoUrl}
            alt={data.madrasaName.trim() || t("branding.previewNameFallback")}
            className="h-14 w-14 shrink-0 rounded-xl border border-border bg-background object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-background">
            <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-foreground">
            {data.madrasaName.trim() || t("branding.previewNameFallback")}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {data.tagline.trim() || t("branding.previewTaglineFallback")}
          </p>
        </div>
      </div>

      {(hasContact || formattedAddress) && (
        <div className="space-y-2 px-5 py-3 text-xs text-muted-foreground">
          {data.email && (
            <p className="flex items-center gap-2 truncate">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{data.email}</span>
            </p>
          )}
          {data.phone && (
            <p className="flex items-center gap-2 truncate">
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{data.phone}</span>
            </p>
          )}
          {data.website && <p className="truncate ps-5">{data.website}</p>}
          {formattedAddress && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{formattedAddress}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
