/**
 * Imperative navigation bridge for code outside React Router (e.g. AuthContext).
 */

type NavigateFn = (path: string, options?: { replace?: boolean }) => void;

let navigateFn: NavigateFn | null = null;

export function registerAppNavigate(fn: NavigateFn): void {
  navigateFn = fn;
}

export function unregisterAppNavigate(): void {
  navigateFn = null;
}

export function appNavigate(path: string, options?: { replace?: boolean }): void {
  if (navigateFn) {
    navigateFn(path, options);
    return;
  }
  window.location.assign(path);
}
