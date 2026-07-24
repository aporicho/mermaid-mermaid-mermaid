import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type DataIconProps = {
  "data-icon"?: string;
};

/** Keep icon metadata consistent without forcing callers to know shadcn internals. */
export function withDataIcon(icon: ReactNode, position = "inline-start") {
  if (!isValidElement(icon)) return icon;
  const element = icon as ReactElement<DataIconProps>;
  return cloneElement(element, {
    "data-icon": element.props["data-icon"] ?? position
  });
}
