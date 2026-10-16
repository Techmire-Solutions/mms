import React from "react";
import { useTranslation } from "@/hooks/useTranslation";

export function PlatformLogoMark({
  size = "lg",
}: {
  size?: "sm" | "lg";
} = {}): React.JSX.Element {
  const { t } = useTranslation();
  const isSm = size === "sm";
  return (
    <div
      className={
        isSm
          ? "flex h-9 w-9 items-center justify-center rounded-xl bg-card border border-primary/40 p-1 shadow-sm shadow-primary/10 overflow-hidden"
          : "mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-primary/40 p-2 shadow-xl shadow-primary/15 transition-transform hover:scale-105 select-none overflow-hidden"
      }
      aria-hidden
    >
      <img
        src="/platform-logo.webp"
        alt={t("entry.productName")}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
