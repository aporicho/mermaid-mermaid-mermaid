export type RuntimeDesktopWindowAction = "minimize" | "toggleMaximize" | "close";

export type RuntimeDesktopWindowOperations = {
  isDesktopWindowAvailable: () => boolean;
  startDesktopWindowDrag: () => Promise<void>;
  toggleDesktopWindowMaximize: () => Promise<void>;
  getDesktopWindowFullscreen: () => Promise<boolean>;
  toggleDesktopWindowFullscreen: () => Promise<boolean>;
  listenForDesktopWindowFullscreenChange: (handler: (fullscreen: boolean) => void) => Promise<() => void>;
  runDesktopWindowAction: (action: RuntimeDesktopWindowAction) => Promise<void>;
  listenForDesktopWindowCloseRequest: (handler: () => boolean | Promise<boolean>) => Promise<() => void>;
};
