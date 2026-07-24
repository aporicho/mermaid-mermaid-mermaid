export const EDITOR_CHROME_TOKENS = {
  baseGridPx: 4,
  layoutGridPx: 8,
  edgeInsetPx: 16,
  floatingButtonPx: 48,
  floatingButtonSlotPx: 48,
  panelIconButtonPx: 32,
  menuRowHeightPx: 32,
  treeRowHeightPx: 32,
  sidePanelTopBottomPx: 64,
  sidePanelGapPx: 16,
  cornerHotZonePx: 112,
  sideHotZoneWidthPx: 96,
  sideHotZoneHeightPx: 128,
  topCenterHotZoneWidthPx: 192,
  topHotZoneHeightPx: 96,
  floatingGroupGapPx: 8
} as const;

export const EDITOR_CHROME_CLASSES = {
  workspaceLayer: "z-[1]",
  applicationChromeLayer: "z-[2]",
  fullscreenWorkspaceLayer: "z-[3]",
  floatingIconButton:
    "relative size-12 rounded-[var(--theme-radius-control-lg)] [backdrop-filter:blur(var(--ui-backdrop-blur))] [&_svg]:[height:var(--ui-icon-size-button)] [&_svg]:[width:var(--ui-icon-size-button)]",
  floatingIconInactive:
    "bg-card/[var(--ui-surface-opacity)] text-icon hover:bg-accent hover:text-foreground",
  floatingIconActive:
    "text-background hover:text-background",
  floatingIconDanger:
    "hover:bg-destructive/10 hover:text-destructive",
  floatingButtonCluster: "flex items-center gap-[var(--ui-control-gap)]",
  panelIconButton: "editor-ui-icon-button text-icon hover:text-foreground",
  menuRow: "min-h-[var(--ui-control-height-sm)] h-auto justify-start px-[var(--ui-control-padding-x)] py-[var(--ui-control-padding-y)] text-foreground [&_svg]:text-icon",
  treeRow: "min-h-[var(--ui-control-height-sm)] h-auto justify-start px-[var(--ui-control-padding-x)] py-[var(--ui-control-padding-y)] text-left text-foreground [&_svg]:text-icon",
  sidePanel:
    "editor-ui-panel grid min-h-0 overflow-hidden"
} as const;

export type FloatingChromePlacement =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "rightView"
  | "rightFilter"
  | "leftCenter"
  | "rightCenter"
  | "leftBottom"
  | "bottomCenter"
  | "rightBottom";

export type FloatingChromePlacementSpec = {
  rootClassName: string;
  hotZoneClassName: string;
  hiddenClassName: string;
};

export const FLOATING_CHROME_PLACEMENTS: Record<FloatingChromePlacement, FloatingChromePlacementSpec> = {
  topLeft: {
    rootClassName: "left-0 top-0",
    hotZoneClassName: "h-28 w-28 items-start justify-start p-4",
    hiddenClassName: "-translate-y-1"
  },
  topCenter: {
    rootClassName: "left-1/2 top-0 -translate-x-1/2",
    hotZoneClassName: "h-24 w-48 items-start justify-center p-4",
    hiddenClassName: "-translate-y-1"
  },
  topRight: {
    rootClassName: "right-0 top-0",
    hotZoneClassName: "h-24 w-48 items-start justify-end p-4",
    hiddenClassName: "-translate-y-1"
  },
  rightView: {
    rootClassName: "right-0 top-16",
    hotZoneClassName: "h-44 w-28 items-start justify-end p-4",
    hiddenClassName: "translate-x-1"
  },
  rightFilter: {
    rootClassName: "right-0 top-60",
    hotZoneClassName: "h-28 w-28 items-start justify-end p-4",
    hiddenClassName: "translate-x-1"
  },
  leftCenter: {
    rootClassName: "left-0 top-1/2 -translate-y-1/2",
    hotZoneClassName: "h-32 w-24 items-center justify-start p-4",
    hiddenClassName: "-translate-x-1"
  },
  rightCenter: {
    rootClassName: "right-0 top-1/2 -translate-y-1/2",
    hotZoneClassName: "h-32 w-24 items-center justify-end p-4",
    hiddenClassName: "translate-x-1"
  },
  leftBottom: {
    rootClassName: "left-0 bottom-0",
    hotZoneClassName: "h-32 w-28 items-end justify-start p-4",
    hiddenClassName: "translate-y-1"
  },
  bottomCenter: {
    rootClassName: "left-1/2 bottom-0 -translate-x-1/2",
    hotZoneClassName: "h-28 w-28 items-end justify-center p-4",
    hiddenClassName: "translate-y-1"
  },
  rightBottom: {
    rootClassName: "right-0 bottom-0",
    hotZoneClassName: "h-32 w-36 items-end justify-end p-4",
    hiddenClassName: "translate-y-1"
  }
};
