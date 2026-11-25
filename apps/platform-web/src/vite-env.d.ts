/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

import type React from "react";

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
  }
}
