import type { ReactNode } from "react";
import { MoreHoriz } from "iconoir-react/regular";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";

export type WorkspaceWindowAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};

export function WorkspaceWindowActionMenu({
  actions,
  tooltipSide
}: {
  actions: readonly WorkspaceWindowAction[];
  tooltipSide: "top" | "right" | "bottom" | "left";
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <EditorIconButton context="panel" label="更多窗口操作" tooltipSide={tooltipSide}>
        <MoreHoriz data-icon />
      </EditorIconButton>
    </DropdownMenuTrigger>
    <DropdownMenuContent side="bottom" align="end" className="min-w-44">
      <DropdownMenuGroup>
        {actions.map((action) => <DropdownMenuItem
          key={action.id}
          disabled={action.disabled}
          className={action.danger ? "text-destructive focus:text-destructive" : undefined}
          onSelect={action.onSelect}
        >
          {action.icon}
          {action.label}
        </DropdownMenuItem>)}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
