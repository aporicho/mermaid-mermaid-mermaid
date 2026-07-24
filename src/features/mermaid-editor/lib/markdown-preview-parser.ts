export type MarkdownPreviewRun = {
  text: string;
  bold: boolean;
};

export type MarkdownPreviewListItem = {
  ordered: boolean;
  ordinal: number;
  depth: number;
  runs: MarkdownPreviewRun[];
};

export type MarkdownPreviewBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: MarkdownPreviewRun[] }
  | { kind: "paragraph"; runs: MarkdownPreviewRun[] }
  | { kind: "list"; items: MarkdownPreviewListItem[] }
  | { kind: "divider" }
  | { kind: "blockquote"; paragraphs: MarkdownPreviewRun[][] };

export function parseMarkdownPreview(source: string, fallbackTitle = ""): MarkdownPreviewBlock[] {
  const lines = stripFrontmatter(source.replace(/\r\n?/g, "\n")).split("\n");
  const blocks: MarkdownPreviewBlock[] = [];
  let paragraph: string[] = [];
  let listItems: MarkdownPreviewListItem[] = [];
  let quoteParagraph: string[] = [];
  let quoteParagraphs: MarkdownPreviewRun[][] = [];
  let fenced = false;

  function flushParagraph() {
    const text = paragraph.join(" ").trim();
    if (text) blocks.push({ kind: "paragraph", runs: parseMarkdownPreviewRuns(text) });
    paragraph = [];
  }

  function flushList() {
    if (listItems.length) blocks.push({ kind: "list", items: listItems });
    listItems = [];
  }

  function flushQuoteParagraph() {
    const text = quoteParagraph.join(" ").trim();
    if (text) quoteParagraphs.push(parseMarkdownPreviewRuns(text));
    quoteParagraph = [];
  }

  function flushQuote() {
    flushQuoteParagraph();
    if (quoteParagraphs.length) blocks.push({ kind: "blockquote", paragraphs: quoteParagraphs });
    quoteParagraphs = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    if (/^\s*```/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      paragraph.push(line.trim());
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushQuote();
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      if (quote[1].trim()) quoteParagraph.push(quote[1].trim());
      else flushQuoteParagraph();
      continue;
    }

    flushQuote();

    const setext = /^\s*(=+|-+)\s*$/.exec(line);
    if (setext && paragraph.length) {
      const text = paragraph.join(" ").trim();
      paragraph = [];
      flushList();
      blocks.push({ kind: "heading", level: setext[1][0] === "=" ? 1 : 2, runs: parseMarkdownPreviewRuns(text) });
      continue;
    }

    if (isThematicBreak(line)) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "divider" });
      continue;
    }

    const heading = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        runs: parseMarkdownPreviewRuns(heading[2])
      });
      continue;
    }

    const unordered = /^(\s*)[-+*]\s+(.+)$/.exec(line);
    const ordered = /^(\s*)(\d+)[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const match = unordered || ordered;
      if (!match) continue;
      listItems.push({
        ordered: Boolean(ordered),
        ordinal: ordered ? Number(ordered[2]) : 0,
        depth: Math.min(6, Math.floor(match[1].length / 2)),
        runs: parseMarkdownPreviewRuns(ordered ? ordered[3] : unordered?.[2] || "")
      });
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushQuote();

  if (fallbackTitle && !blocks.some((block) => block.kind === "heading" && block.level === 1)) {
    blocks.unshift({ kind: "heading", level: 1, runs: parseMarkdownPreviewRuns(fallbackTitle) });
  }
  return blocks;
}

export function parseMarkdownPreviewRuns(source: string): MarkdownPreviewRun[] {
  const runs: MarkdownPreviewRun[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const asterisk = source.indexOf("**", cursor);
    const underscore = source.indexOf("__", cursor);
    const start = [asterisk, underscore].filter((index) => index >= 0).sort((left, right) => left - right)[0] ?? -1;
    if (start < 0) {
      pushRun(runs, cleanInlineMarkdown(source.slice(cursor)), false);
      break;
    }
    const marker = source.slice(start, start + 2);
    const end = source.indexOf(marker, start + 2);
    if (end < 0) {
      pushRun(runs, cleanInlineMarkdown(source.slice(cursor)), false);
      break;
    }
    pushRun(runs, cleanInlineMarkdown(source.slice(cursor, start)), false);
    pushRun(runs, cleanInlineMarkdown(source.slice(start + 2, end)), true);
    cursor = end + 2;
  }
  return runs;
}

function pushRun(runs: MarkdownPreviewRun[], text: string, bold: boolean) {
  if (!text) return;
  const previous = runs.at(-1);
  if (previous?.bold === bold) previous.text += text;
  else runs.push({ text, bold });
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2")
    .replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1$2")
    .replace(/\\([\\`*_[\]{}()#+.!-])/g, "$1");
}

function isThematicBreak(line: string) {
  const leadingSpaces = /^ */.exec(line)?.[0].length ?? 0;
  if (leadingSpaces > 3) return false;
  const compact = line.trim().replace(/[ \t]/g, "");
  return compact.length >= 3 && /^(?:\*+|-+|_+)$/.test(compact);
}

function stripFrontmatter(source: string) {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") return source;
  const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  return endIndex < 0 ? source : lines.slice(endIndex + 2).join("\n");
}
