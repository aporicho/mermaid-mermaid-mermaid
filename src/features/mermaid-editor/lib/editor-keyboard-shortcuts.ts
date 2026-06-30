export type CreateGroupShortcutInput = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat?: boolean;
  editable: boolean;
  hasSelection: boolean;
};

export function shouldCreateGroupFromShortcut(input: CreateGroupShortcutInput) {
  return (
    input.editable &&
    input.hasSelection &&
    !input.repeat &&
    !input.shiftKey &&
    !input.altKey &&
    (input.ctrlKey || input.metaKey) &&
    input.key.toLowerCase() === "g"
  );
}
