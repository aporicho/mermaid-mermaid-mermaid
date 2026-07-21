export const MARKDOWN_TEXT_SCALE_MIN = 0.7;
export const MARKDOWN_TEXT_SCALE_MAX = 2;
export const MARKDOWN_TEXT_SCALE_STEP = 0.1;
export const DEFAULT_MARKDOWN_TEXT_SCALE = 1;

export function clampMarkdownTextScale(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MARKDOWN_TEXT_SCALE;
  const clamped = Math.min(MARKDOWN_TEXT_SCALE_MAX, Math.max(MARKDOWN_TEXT_SCALE_MIN, value));
  return Number((Math.round(clamped / MARKDOWN_TEXT_SCALE_STEP) * MARKDOWN_TEXT_SCALE_STEP).toFixed(1));
}

export function adjustMarkdownTextScale(value: number, direction: -1 | 1) {
  return clampMarkdownTextScale(clampMarkdownTextScale(value) + direction * MARKDOWN_TEXT_SCALE_STEP);
}

export function markdownTextScalePercent(value: number) {
  return `${Math.round(clampMarkdownTextScale(value) * 100)}%`;
}
