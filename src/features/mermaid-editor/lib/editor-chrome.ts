export const EDITOR_CHROME_TOKENS = {
  baseGridPx: 4,
  layoutGridPx: 8,
  edgeInsetPx: 16,
  floatingButtonPx: 40,
  floatingButtonSlotPx: 48,
  panelIconButtonPx: 32,
  menuRowHeightPx: 32,
  treeRowHeightPx: 28,
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
  floatingIconButton:
    "relative size-10 rounded-full shadow-sm backdrop-blur [&_svg]:size-4",
  floatingIconInactive:
    "border bg-card/95 text-icon hover:text-icon",
  floatingIconActive:
    "text-background hover:text-background",
  floatingIconDanger:
    "hover:bg-destructive/10 hover:text-destructive",
  floatingButtonCluster: "flex items-center gap-2",
  panelIconButton: "size-8 text-icon hover:text-icon [&_svg]:size-4",
  menuRow: "h-8 justify-start px-2 text-foreground [&_svg]:text-icon [&_svg]:size-4",
  treeRow: "h-7 justify-start px-2 text-left text-foreground [&_svg]:text-icon",
  sidePanel:
    "absolute bottom-16 top-16 z-20 overflow-hidden rounded-md border bg-card/95 shadow-sm backdrop-blur"
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
  rightBottom: {
    rootClassName: "right-0 bottom-0",
    hotZoneClassName: "h-32 w-36 items-end justify-end p-4",
    hiddenClassName: "translate-y-1"
  }
};
