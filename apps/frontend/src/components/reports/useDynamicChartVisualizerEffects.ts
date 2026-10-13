import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type {
  ChartOperation,
  ChartType,
  CollectionMeta,
  FilterRule,
} from "./dynamicChartVisualizerTypes";
import { isDateDimensionField } from "./dynamicChartVisualizerHelpers";
import { getDefaultCollectionField } from "./dynamicChartVisualizerPin";

export function useDynamicChartVisualizerMetaEffects(input: {
  collectionKey: string;
  xAxisField: string;
  operation: ChartOperation;
  activeMeta: CollectionMeta;
  metadataConfigs: Record<string, CollectionMeta>;
  isInitialMount: MutableRefObject<boolean>;
  setXAxisField: Dispatch<SetStateAction<string>>;
  setChartType: Dispatch<SetStateAction<ChartType>>;
  setTargetField: Dispatch<SetStateAction<string>>;
  setOperation: Dispatch<SetStateAction<ChartOperation>>;
  setFilters: Dispatch<SetStateAction<FilterRule[]>>;
}): void {
  const {
    collectionKey,
    xAxisField,
    operation,
    activeMeta,
    metadataConfigs,
    isInitialMount,
    setXAxisField,
    setChartType,
    setTargetField,
    setOperation,
    setFilters,
  } = input;

  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }
    const meta = metadataConfigs[collectionKey];
    if (meta) {
      const defaultField = getDefaultCollectionField(meta);
      if (defaultField) {
        setXAxisField(defaultField);
        setChartType(isDateDimensionField(defaultField) ? "line" : "bar");
      }
      if (meta.numericFields[0]) {
        setTargetField(meta.numericFields[0].value);
      } else {
        setTargetField("");
        setOperation("count");
      }
    }
    setFilters([]);
  }, [
    collectionKey,
    isInitialMount,
    metadataConfigs,
    setChartType,
    setFilters,
    setOperation,
    setTargetField,
    setXAxisField,
  ]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setChartType(isDateDimensionField(xAxisField) ? "line" : "bar");
  }, [isInitialMount, setChartType, xAxisField]);

  useEffect(() => {
    if (activeMeta.numericFields.length === 0 && operation !== "count") {
      setOperation("count");
    }
  }, [activeMeta, operation, setOperation]);
}
