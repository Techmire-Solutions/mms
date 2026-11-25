/**
 * The app-runtime seam for resolving the filesystem uploads root. The app
 * configures this once at startup (`resolveUploadsRoot`), so module media
 * services can resolve media paths without importing app config.
 */
let uploadsRootProvider: (() => string) | null = null;

export function configureUploadsRoot(provider: () => string): void {
  uploadsRootProvider = provider;
}

export function getUploadsRoot(): string {
  if (!uploadsRootProvider) throw new Error("Uploads root is not configured");
  return uploadsRootProvider();
}
