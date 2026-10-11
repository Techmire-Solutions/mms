import { useCallback, useMemo, useRef } from "react";
import {
  getFlatFieldsConfig,
  getSortedFields,
  type ModuleCustomField,
  type ModuleFieldDef,
} from "@mms/shared";
import { reportClientError } from "@/lib/clientErrorReporting";

export interface StandardModuleConfigSettingsLike {
  fields?: Record<string, unknown>;
  customFields?: ModuleCustomField[] | unknown[];
  fieldOrder?: string[];
  formTabs?: unknown[];
  enabledTabs?: string[];
  requiredTabs?: string[];
}

export interface StandardModuleConfigCore<TSettings extends StandardModuleConfigSettingsLike> {
  settings: TSettings;
  orderedFields: ModuleFieldDef[];
  fields: Record<string, { enabled: boolean; required: boolean }>;
  customFields: ModuleCustomField[];
  updateSettings: (draft: TSettings) => void;
  updateSettingsAsync: (draft: TSettings) => Promise<void>;
  reloadConfig: () => void;
  mergeSettings: (draft: Partial<TSettings> | null | undefined) => TSettings;
  loadSettings: () => TSettings;
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
}

export interface CreateStandardModuleConfigHookOptions<
  TSettings extends StandardModuleConfigSettingsLike,
  TExtra extends Record<string, unknown>,
> {
  defaultSettings: TSettings;
  defaultFieldDefs: readonly ModuleFieldDef[];
  useSettings?: () => TSettings;
  useUpdateSettingsAsync?: () => (draft: TSettings) => Promise<void>;
  customFieldsFrom?: (settings: TSettings) => ModuleCustomField[];
  orderedFieldsFrom?: (ctx: { fieldOrder: string[]; settings: TSettings }) => ModuleFieldDef[];
  lookupsFrom?: () => TExtra;
  useEnhance?: (core: StandardModuleConfigCore<TSettings>) => TExtra;
}

export function createStandardModuleConfigHook<
  TSettings extends StandardModuleConfigSettingsLike,
  TExtra extends Record<string, unknown> = Record<string, never>,
>(options: CreateStandardModuleConfigHookOptions<TSettings, TExtra>) {
  const {
    defaultSettings,
    defaultFieldDefs,
    useSettings,
    useUpdateSettingsAsync,
    customFieldsFrom,
    orderedFieldsFrom,
    lookupsFrom,
    useEnhance,
  } = options;

  const useModuleSettings = useSettings ?? (() => defaultSettings);
  const useModuleUpdate = useUpdateSettingsAsync ?? (() => undefined);

  return function useStandardModuleConfigHook() {
    const loadedSettings = useModuleSettings();
    const settings = loadedSettings ?? defaultSettings;

    const mergeSettings = useCallback(
      (settingsDraft: Partial<TSettings> | null | undefined): TSettings => {
        return {
          ...defaultSettings,
          ...settings,
          ...(settingsDraft ?? {}),
        };
      },
      [defaultSettings, settings],
    );

    const updateAsyncFn = useModuleUpdate();
    const updateAsyncRef = useRef(updateAsyncFn);
    updateAsyncRef.current = updateAsyncFn;

    const updateSettingsAsync = useCallback(async (settingsDraft: TSettings): Promise<void> => {
      if (updateAsyncRef.current) {
        await updateAsyncRef.current(settingsDraft);
      }
    }, []);

    const updateSettings = useCallback(
      (settingsDraft: TSettings): void => {
        void updateSettingsAsync(settingsDraft).catch((error) => {
          reportClientError(error, { context: "standardModuleConfig.updateSettings" });
        });
      },
      [updateSettingsAsync],
    );

    const fields = useMemo(() => getFlatFieldsConfig(settings.fields), [settings.fields]);

    const customFields = useMemo(
      () =>
        customFieldsFrom
          ? customFieldsFrom(settings)
          : ((settings.customFields ?? []) as ModuleCustomField[]),
      [customFieldsFrom, settings],
    );

    const fieldOrder = settings.fieldOrder ?? defaultSettings.fieldOrder ?? [];

    const orderedFields = useMemo(
      () =>
        orderedFieldsFrom
          ? orderedFieldsFrom({ fieldOrder, settings })
          : getSortedFields(defaultFieldDefs, fieldOrder, fields, customFields),
      [orderedFieldsFrom, defaultFieldDefs, fieldOrder, settings, fields, customFields],
    );

    const reloadConfig = useCallback(() => {}, []);
    const loadSettings = useCallback(() => settings, [settings]);

    const isFieldEnabled = useCallback(
      (fieldId: string): boolean => fields[fieldId]?.enabled !== false,
      [fields],
    );

    const isFieldRequired = useCallback(
      (fieldId: string): boolean => !!fields[fieldId]?.required,
      [fields],
    );

    const extra = lookupsFrom ? lookupsFrom() : ({} as TExtra);
    const core: StandardModuleConfigCore<TSettings> = {
      settings,
      orderedFields,
      fields,
      customFields,
      updateSettings,
      updateSettingsAsync,
      reloadConfig,
      mergeSettings,
      loadSettings,
      isFieldEnabled,
      isFieldRequired,
    };

    const enhanceForCore = useEnhance ?? (() => ({}) as TExtra);
    const enhanced = enhanceForCore(core);

    return {
      ...core,
      ...extra,
      ...enhanced,
    };
  };
}
