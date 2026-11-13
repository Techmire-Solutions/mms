import React, { useState, useEffect, useRef } from "react";

interface LazyDeferredViewProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  minHeight?: number | string;
  className?: string;
}

/**
 * Defers rendering below-the-fold content until the user scrolls near it using IntersectionObserver.
 * Reduces Total Blocking Time (TBT) and long-task scripting during initial mobile route mount.
 */
export function LazyDeferredView({
  children,
  fallback = null,
  rootMargin = "250px 0px",
  minHeight,
  className,
}: LazyDeferredViewProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(() => {
    return typeof window !== "undefined" && !("IntersectionObserver" in window);
  });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isVisible) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    const element = containerRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [isVisible, rootMargin]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={!isVisible && minHeight ? { minHeight } : undefined}
    >
      {isVisible ? children : fallback}
    </div>
  );
}

export default LazyDeferredView;
