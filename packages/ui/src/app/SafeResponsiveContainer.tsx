import React, { useEffect, useRef, useState } from "react";
import { ResponsiveContainer, type ResponsiveContainerProps } from "recharts";

type SafeResponsiveContainerProps = Omit<ResponsiveContainerProps, "width" | "height"> & {
  width?: number | string;
  height?: number | string;
  /** Accessible label rendered as role="img" + aria-label on the wrapper (WCAG 1.1.1). */
  ariaLabel?: string;
};

/**
 * Delays Recharts mounting until the container has real dimensions.
 * This avoids zero-width warnings while report tabs animate into view.
 */
export function SafeResponsiveContainer({
  width = "100%",
  height,
  ariaLabel,
  children,
  ...props
}: SafeResponsiveContainerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const wrapperStyle: React.CSSProperties = {
    width,
    height,
    minWidth: 0,
    minHeight: typeof height === "number" ? height : 1,
  };

  return (
    <div
      ref={containerRef}
      style={wrapperStyle}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      {size.width > 0 && size.height > 0 ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={1}
          minHeight={1}
          initialDimension={{ width: size.width, height: size.height }}
          {...props}
        >
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export default SafeResponsiveContainer;
