import React from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb as SharedBreadcrumb,
  type BreadcrumbProps as SharedBreadcrumbProps,
  type BreadcrumbItem,
} from "@shared/ui";

export { type BreadcrumbItem };
export type BreadcrumbProps = SharedBreadcrumbProps;

/**
 * Shared breadcrumb trail facade — wires in react-router-dom Link automatically.
 */
export function Breadcrumb({ renderLink, ...props }: BreadcrumbProps): React.JSX.Element {
  return (
    <SharedBreadcrumb
      renderLink={
        renderLink ??
        ((item) => (
          <Link
            to={item.href!}
            className="font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {item.label}
          </Link>
        ))
      }
      {...props}
    />
  );
}

Breadcrumb.displayName = "Breadcrumb";
export default Breadcrumb;
