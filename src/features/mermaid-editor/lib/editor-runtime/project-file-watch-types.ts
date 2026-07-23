export type RuntimeProjectFileChange = {
  directory: boolean;
  kind: "added" | "changed" | "removed";
  path: string;
};

export type RuntimeProjectFileChangeBatch = {
  rootPath?: string;
  changes: RuntimeProjectFileChange[];
  observedAt: number;
};

export type RuntimeProjectFileWatchTargets = {
  rootPath?: string;
  extraPaths?: string[];
};

export type RuntimeProjectFileWatchOperations = {
  setProjectFileWatchTargets: (targets: RuntimeProjectFileWatchTargets) => Promise<void>;
  listenForProjectFileChanges: (handler: (batch: RuntimeProjectFileChangeBatch) => void) => Promise<() => void>;
};
