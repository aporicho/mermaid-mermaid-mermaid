/**
 * Layer values are deliberately local to an isolated stacking context.
 * Large global z-index values cannot order Electron WebContentsView surfaces,
 * and make a portal lose the ownership of the window that opened it.
 */
export const OVERLAY_Z_INDEX = {
  workspaceBase: 1,
  floatingPopover: 1,
  contextMenu: 1,
  modal: 1,
  dropdown: 3,
  tooltip: 4,
  statusToast: 3,
  banner: 3
} as const;
