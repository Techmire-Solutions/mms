import React, { useMemo } from "react";
import { cn } from "../utils";

export interface ThemeScopeTokens {
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  background?: string;
  foreground?: string;
  radius?: string;
  mode?: "light" | "dark";
  dir?: "ltr" | "rtl";
}

export interface ThemeScopeProps extends React.HTMLAttributes<HTMLDivElement> {
  theme?: ThemeScopeTokens;
  as?: React.ElementType;
  children: React.ReactNode;
}

/** Computes WCAG AA accessible text color (black or white) for a hex background. */
function getContrastColor(hexColor?: string): string | undefined {
  if (!hexColor || !hexColor.startsWith("#") || (hexColor.length !== 7 && hexColor.length !== 4)) {
    return undefined;
  }
  const fullHex =
    hexColor.length === 4
      ? `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`
      : hexColor;

  const r = parseInt(fullHex.slice(1, 3), 16) / 255;
  const g = parseInt(fullHex.slice(3, 5), 16) / 255;
  const b = parseInt(fullHex.slice(5, 7), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const l = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  // WCAG relative luminance midpoint where contrast against black exceeds contrast against white is sqrt(1.05 * 0.05) - 0.05 ≈ 0.179
  return l > 0.179 ? "#000000" : "#ffffff";
}

/**
 * Scopes theme overrides (tenant custom branding or platform admin palette)
 * to a DOM subtree while preserving core accessibility tokens.
 */
export function ThemeScope({
  theme,
  as: Component = "div",
  className,
  style,
  dir,
  children,
  ...rest
}: ThemeScopeProps): React.JSX.Element {
  const inlineStyles = useMemo<React.CSSProperties>(() => {
    const custom: Record<string, string> = {};

    if (theme?.primary) {
      custom["--primary"] = theme.primary;
      custom["--color-primary"] = theme.primary;
      const fg = theme.primaryForeground ?? getContrastColor(theme.primary) ?? "#ffffff";
      custom["--primary-foreground"] = fg;
      custom["--color-primary-foreground"] = fg;
    }

    if (theme?.secondary) {
      custom["--secondary"] = theme.secondary;
      custom["--color-secondary"] = theme.secondary;
      const fg = theme.secondaryForeground ?? getContrastColor(theme.secondary) ?? "#ffffff";
      custom["--secondary-foreground"] = fg;
      custom["--color-secondary-foreground"] = fg;
    }

    if (theme?.background) {
      custom["--background"] = theme.background;
      custom["--color-background"] = theme.background;
    }

    if (theme?.foreground) {
      custom["--foreground"] = theme.foreground;
      custom["--color-foreground"] = theme.foreground;
    }

    if (theme?.radius) {
      custom["--radius"] = theme.radius;
    }

    return {
      ...custom,
      ...style,
    } as React.CSSProperties;
  }, [theme, style]);

  const effectiveDir = dir ?? theme?.dir;

  return (
    <Component
      className={cn(
        "theme-scope",
        theme?.mode === "dark" && "dark",
        theme?.mode === "light" && "light",
        className,
      )}
      style={inlineStyles}
      dir={effectiveDir}
      data-theme={theme?.mode}
      {...rest}
    >
      {children}
    </Component>
  );
}
