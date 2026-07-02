export type TauriCurrentWindow = {
  startDragging: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  destroy: () => Promise<void>;
  onCloseRequested: (handler: (event: { preventDefault: () => void }) => void | Promise<void>) => Promise<() => void>;
};

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getTauriCurrentWindow() {
  if (!isTauriRuntime()) return null;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow() as TauriCurrentWindow;
}

export function formatRuntimeError(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "payload" in error) {
    return formatRuntimeError((error as { payload?: unknown }).payload);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export async function filePathToDisplaySrc(path: string) {
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(path);
}

export function exposedNativeFilePath(file: File) {
  const path = (file as File & { path?: unknown }).path;
  return typeof path === "string" && path ? path : undefined;
}
