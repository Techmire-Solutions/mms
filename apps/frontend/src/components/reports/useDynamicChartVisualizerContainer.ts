import { useEffect, useState, type RefObject } from "react";
import {
  computeAxisFontSize,
  computeLegendFontSize,
  computeTickGap,
} from "@/components/reports/dynamicChartVisualizerPin";

export function useDynamicChartVisualizerContainer(chartRef: RefObject<HTMLDivElement | null>) {
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    if (!chartRef.current) return;
    const observer = new ResizeObserver((resizeEntries) => {
      for (const resizeEntry of resizeEntries) {
        if (resizeEntry.contentRect.width > 0) {
          setContainerWidth(resizeEntry.contentRect.width);
        }
      }
    });
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [chartRef]);

  const axisFontSize = (() => computeAxisFontSize(containerWidth))();
  const legendFontSize = (() => computeLegendFontSize(containerWidth))();
  const tickGap = (() => computeTickGap(containerWidth))();

  return { containerWidth, axisFontSize, legendFontSize, tickGap };
}
