import React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useBranding } from "@/tenant/hooks/useBranding";
import { getInitials } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ROUTES } from "@/lib/config/routes";
import { LOGO_IMAGE } from "@/lib/ui/semanticTone";

interface SidebarBrandProps {
  collapsed: boolean;
}

export function SidebarBrand({ collapsed }: SidebarBrandProps): React.JSX.Element {
  const branding = useBranding();
  const { t } = useTranslation();
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [branding.logoUrl]);

  return (
    <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
      <Link
        to={ROUTES.home}
        className="flex min-h-11 min-w-11 items-center gap-3 overflow-hidden hover:opacity-90 transition-opacity"
      >
        {branding.logoUrl && !imgError ? (
          <img
            src={branding.logoUrl}
            alt="Logo"
            className={`h-8 w-8 shrink-0 rounded-lg ${LOGO_IMAGE} border-sidebar-border`}
            width={32}
            height={32}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sidebar-primary-foreground font-display text-lg font-bold">
              {branding.madrasaName ? getInitials(branding.madrasaName, 1) : "م"}
            </span>
          </div>
        )}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <span className="text-sidebar-foreground font-semibold text-sm tracking-wide">
                {branding.madrasaName || t("entry.productName")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>
    </div>
  );
}
