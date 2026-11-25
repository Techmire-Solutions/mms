/** True when the document is embedded in an iframe (app shell host). */
export const isIframe: boolean = typeof window !== "undefined" && window.self !== window.top;
