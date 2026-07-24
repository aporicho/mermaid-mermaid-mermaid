import type { EditorTypographyTokens } from "./typography-types";
import type { MarkdownThemeTokens } from "./markdown-types";

const SANS = '"Noto Sans SC Variable", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
const SHANGTU = '"上图东观体", "Noto Sans SC Variable", "Noto Sans SC", system-ui, sans-serif';
const FOUNDER_SERIF = '"方正屏显雅宋简体", "Songti SC", "Noto Serif SC", serif';

export function migrateLegacyReadingFontProfile(
  markdown: MarkdownThemeTokens,
  typography: EditorTypographyTokens,
  source: { version: unknown; baseThemeId: string | undefined }
) {
  if (typeof source.version === "number" && source.version >= 10) return;
  const legacyHeading =
    source.baseThemeId === "claude-cream" ? SHANGTU : source.baseThemeId === "warm-paper" ? SANS : null;
  if (!legacyHeading) return;

  for (const heading of Object.values(markdown.heading)) {
    if (heading.fontFamily === legacyHeading) heading.fontFamily = FOUNDER_SERIF;
  }
  if (source.baseThemeId === "warm-paper" && typography.markdownCard.excerpt.family === FOUNDER_SERIF) {
    typography.markdownCard.excerpt.family = SANS;
  }
  if (source.baseThemeId === "claude-cream") {
    for (const role of [
      typography.markdownCard.title,
      typography.markdownCard.titleEditor,
      typography.canvasDocument.card,
      typography.canvasDocument.cardEditor
    ]) {
      if (role.family === SHANGTU) role.family = FOUNDER_SERIF;
    }
  }
}
