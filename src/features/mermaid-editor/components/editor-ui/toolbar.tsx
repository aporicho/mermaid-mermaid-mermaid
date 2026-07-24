import { forwardRef, type HTMLAttributes } from "react";

import { ButtonGroup } from "@/components/ui/button-group";

export const EditorToolbar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }>(function EditorToolbar({ className, orientation = "horizontal", ...props }, ref) {
  return <ButtonGroup ref={ref} role="toolbar" aria-orientation={orientation} orientation={orientation} className={className} {...props} />;
});

export function EditorToolbarGroup({ className, orientation = "horizontal", ...props }: HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return <ButtonGroup orientation={orientation} className={className} {...props} />;
}
