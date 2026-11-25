interface GlobalSettingsImpl {
  getGlobalSettings: (...args: any[]) => any;
  saveGlobalSettingsAsync: (...args: any[]) => Promise<any>;
}

let impl: GlobalSettingsImpl | null = null;

export function configureMessagingGlobalSettings(next: GlobalSettingsImpl): void {
  impl = next;
}

export function getGlobalSettings(...args: any[]): any {
  return impl?.getGlobalSettings(...args) ?? {};
}

export function saveGlobalSettingsAsync(...args: any[]): Promise<any> {
  return impl?.saveGlobalSettingsAsync(...args) ?? Promise.resolve();
}
