export const MARKDOWN_FOLD_SNAPSHOT_VERSION = 1 as const;

export type MarkdownHeadingFoldSegment = {
  level: number;
  label: string;
  occurrence: number;
};

export type MarkdownListFoldSegment = {
  label: string;
  occurrence: number;
};

export type MarkdownFoldAnchor =
  | {
      kind: "heading";
      outline: MarkdownHeadingFoldSegment[];
    }
  | {
      kind: "list-item";
      section: MarkdownHeadingFoldSegment[];
      rootOccurrence: number;
      path: MarkdownListFoldSegment[];
    };

export type MarkdownFoldSnapshot = {
  version: typeof MARKDOWN_FOLD_SNAPSHOT_VERSION;
  documentFingerprint: string;
  folds: MarkdownFoldAnchor[];
};

export function emptyMarkdownFoldSnapshot(documentFingerprint = ""): MarkdownFoldSnapshot {
  return {
    version: MARKDOWN_FOLD_SNAPSHOT_VERSION,
    documentFingerprint,
    folds: []
  };
}

export function normalizeMarkdownFoldSnapshot(value: unknown): MarkdownFoldSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MarkdownFoldSnapshot>;
  if (candidate.version !== MARKDOWN_FOLD_SNAPSHOT_VERSION || typeof candidate.documentFingerprint !== "string" || !Array.isArray(candidate.folds)) {
    return null;
  }

  const folds = candidate.folds.flatMap((fold) => {
    const normalized = normalizeFoldAnchor(fold);
    return normalized ? [normalized] : [];
  });
  return {
    version: MARKDOWN_FOLD_SNAPSHOT_VERSION,
    documentFingerprint: candidate.documentFingerprint,
    folds
  };
}

export function markdownFoldSnapshotKey(snapshot: MarkdownFoldSnapshot | null | undefined) {
  return snapshot ? JSON.stringify(snapshot) : "";
}

function normalizeFoldAnchor(value: unknown): MarkdownFoldAnchor | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MarkdownFoldAnchor>;
  if (candidate.kind === "heading") {
    const outline = normalizeHeadingSegments(candidate.outline);
    return outline.length ? { kind: "heading", outline } : null;
  }
  if (candidate.kind !== "list-item") return null;

  const section = normalizeHeadingSegments(candidate.section);
  const path = normalizeListSegments(candidate.path);
  const rootOccurrence = normalizeOccurrence(candidate.rootOccurrence);
  return path.length && rootOccurrence !== null
    ? { kind: "list-item", section, rootOccurrence, path }
    : null;
}

function normalizeHeadingSegments(value: unknown): MarkdownHeadingFoldSegment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((segment) => {
    if (!segment || typeof segment !== "object") return [];
    const candidate = segment as Partial<MarkdownHeadingFoldSegment>;
    const level = Number(candidate.level);
    const occurrence = normalizeOccurrence(candidate.occurrence);
    const label = normalizeLabel(candidate.label);
    return Number.isInteger(level) && level >= 1 && level <= 6 && occurrence !== null && label
      ? [{ level, label, occurrence }]
      : [];
  });
}

function normalizeListSegments(value: unknown): MarkdownListFoldSegment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((segment) => {
    if (!segment || typeof segment !== "object") return [];
    const candidate = segment as Partial<MarkdownListFoldSegment>;
    const occurrence = normalizeOccurrence(candidate.occurrence);
    const label = normalizeLabel(candidate.label);
    return occurrence !== null && label ? [{ label, occurrence }] : [];
  });
}

function normalizeOccurrence(value: unknown) {
  const occurrence = Number(value);
  return Number.isInteger(occurrence) && occurrence >= 0 ? occurrence : null;
}

function normalizeLabel(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 256) : "";
}
