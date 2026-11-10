/**
 * Debounce between the select's built-in search input and the remote registry
 * lookup. The popover owns the only search field, so every keystroke here is a
 * network round-trip; 250 ms matches the rest of the app's search filters.
 */
export const SELECT_SEARCH_DEBOUNCE_MS = 250;
