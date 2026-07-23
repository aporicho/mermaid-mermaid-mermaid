export type BrowserToolWindowRequest = {
  url: string;
  title?: string;
  sourceNodeId?: string;
  sourceLabel?: string;
};

export function normalizeBrowserUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isHttpUrl(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return "";
}

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function browserToolWindowTitle(url: string, fallback?: string) {
  const normalizedFallback = fallback?.trim();
  if (normalizedFallback) return normalizedFallback;

  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

export function browserToolWindowLabel(url: string) {
  return `browser-tool-${hashText(url)}`;
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
