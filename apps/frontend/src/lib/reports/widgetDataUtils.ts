/** Widget collection snapshots, aggregate readers, and value/chart compute. */
export { getWidgetCollections, getFilteredRecords } from "./widgetCollectionSnapshot.js";
export {
  computeWidgetSingleValue,
  computeWidgetChartData,
  type WidgetChartDataPoint,
  computeContactsCustomCardValue,
  computeStudentsCustomCardValue,
  computeFacultyCustomCardValue,
  computeSessionsCustomCardValue,
  computeEnrollmentsCustomCardValue,
} from "./widgetValueCompute.js";
