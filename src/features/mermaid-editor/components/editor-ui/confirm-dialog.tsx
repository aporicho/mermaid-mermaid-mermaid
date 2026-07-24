import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type EditorConfirmActionTone = "primary" | "neutral" | "danger";

export type EditorConfirmAction<ActionId extends string = string> = {
  id: ActionId;
  label: ReactNode;
  tone?: EditorConfirmActionTone;
  disabled?: boolean;
};

type EditorConfirmDialogProps<ActionId extends string> = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  actions: readonly EditorConfirmAction<ActionId>[];
  primaryActionId: ActionId;
  cancelActionId: ActionId;
  onAction: (action: ActionId) => void;
  size?: "sm" | "md" | "lg";
  contained?: boolean;
  container?: HTMLElement | null;
  className?: string;
  /** Set to false only when an existing host already owns Escape handling. */
  handleEscape?: boolean;
};

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

export function EditorConfirmDialog<ActionId extends string>({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  actions,
  primaryActionId,
  cancelActionId,
  onAction,
  size = "sm",
  contained = false,
  container,
  className,
  handleEscape = true
}: EditorConfirmDialogProps<ActionId>) {
  const primaryAction = actions.find((action) => action.id === primaryActionId);
  const dangerActions = actions.filter((action) => action.tone === "danger");
  const standardActions = actions.filter((action) => action.tone !== "danger");
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (open) resolvingRef.current = false;
  }, [open]);

  function resolve(actionId: ActionId) {
    const action = actions.find((candidate) => candidate.id === actionId);
    if (!action || action.disabled) return;
    onAction(actionId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return;
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    if (isTextEntryTarget(event.target) || event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    resolve(primaryActionId);
  }

  function renderAction(action: EditorConfirmAction<ActionId>) {
    const tone = action.tone ?? "neutral";
    const Action = action.id === cancelActionId ? AlertDialogCancel : AlertDialogAction;
    return (
      <Action
        key={action.id}
        variant={tone === "primary" ? "default" : "ghost"}
        className={cn(
          tone === "danger" && "text-destructive hover:bg-destructive/10 hover:text-destructive"
        )}
        disabled={action.disabled}
        autoFocus={action.id === primaryActionId && !primaryAction?.disabled}
        onClick={() => {
          resolvingRef.current = true;
          resolve(action.id);
        }}
      >
        {action.label}
      </Action>
    );
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange?.(nextOpen);
        if (!nextOpen && resolvingRef.current) {
          resolvingRef.current = false;
          return;
        }
        if (!nextOpen) resolve(cancelActionId);
      }}
    >
      <AlertDialogContent
        contained={contained}
        container={container}
        className={cn(size === "sm" && "max-w-[420px]", size === "lg" && "max-w-[760px]", className)}
        onEscapeKeyDown={(event) => { if (!handleEscape) event.preventDefault(); }}
        onKeyDown={handleKeyDown}
      >
        <AlertDialogHeader data-editor-confirm-header className={cn(icon && "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3")}>
          {icon ? <div className="row-span-2">{icon}</div> : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter data-editor-confirm-footer className="justify-between">
          <div className="flex flex-wrap items-center gap-[var(--ui-control-gap)]">
            {dangerActions.map(renderAction)}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-[var(--ui-control-gap)]">
            {standardActions.map(renderAction)}
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
