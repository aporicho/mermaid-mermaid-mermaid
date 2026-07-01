export function parentDirectoryPath(path: string | undefined) {
  if (!path) return undefined;
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index > 0 ? path.slice(0, index) : undefined;
}

export function runtimeFileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path || "document";
}

export function isAbsoluteRuntimePath(path: string) {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

export function joinRuntimePath(base: string | undefined, relativePath: string) {
  if (!base) return relativePath;
  if (isAbsoluteRuntimePath(relativePath)) return relativePath;
  const separator = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return `${base.replace(/[\\/]+$/, "")}${separator}${relativePath.replace(/^[\\/]+/, "")}`;
}

export function normalizeProjectRelativePath(path: string) {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/").toLowerCase();
}
