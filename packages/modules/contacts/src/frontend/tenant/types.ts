/** Generic saved-report source shape (mirrors the app's saved-reports hook). */
export interface SavedReportsSource<TReport, TCreateInput> {
  reports: TReport[];
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  createReport: (input: TCreateInput) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  runReport: (id: string) => Promise<void>;
}
