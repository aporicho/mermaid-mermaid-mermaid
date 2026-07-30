let micromarkPromise;

async function findMarkdownFileReferences(source) {
  const events = await parseMarkdownEvents(source);
  const tokens = events.filter(([event]) => event === "enter").map(([, token]) => token);
  const containers = tokens.filter((token) => token.type === "image" || token.type === "link");
  const destinations = tokens.filter((token) => token.type === "resourceDestinationString");
  const references = [];

  for (const destination of destinations) {
    const container = smallestContainer(destination, containers);
    if (!container) continue;
    references.push(referenceFromToken(source, destination, container.type === "image" ? "media" : "link"));
  }

  const definitionContainers = tokens.filter((token) => token.type === "definition");
  const definitions = new Map();
  for (const definition of definitionContainers) {
    const label = containedToken(definition, tokens, "definitionLabelString");
    const destination = containedToken(definition, tokens, "definitionDestinationString");
    const identifier = label ? normalizeIdentifier(source.slice(label.start.offset, label.end.offset)) : "";
    if (identifier && destination && !definitions.has(identifier)) definitions.set(identifier, destination);
  }

  const definitionUsage = new Map();
  for (const container of containers) {
    if (destinations.some((destination) => contains(container, destination))) continue;
    const explicit = containedToken(container, tokens, "referenceString");
    const fallback = containedToken(container, tokens, "labelText");
    const identifierToken = explicit || fallback;
    const identifier = identifierToken ? normalizeIdentifier(source.slice(identifierToken.start.offset, identifierToken.end.offset)) : "";
    if (!identifier) continue;
    const modes = definitionUsage.get(identifier) || new Set();
    modes.add(container.type === "image" ? "media" : "link");
    definitionUsage.set(identifier, modes);
  }

  for (const [identifier, modes] of definitionUsage) {
    const destination = definitions.get(identifier);
    if (!destination) continue;
    references.push(referenceFromToken(source, destination, modes.size > 1 ? "mixed" : [...modes][0]));
  }

  for (const token of tokens.filter((candidate) => candidate.type === "htmlText" || candidate.type === "htmlFlow")) {
    references.push(...htmlFileReferences(source, token));
  }

  return uniqueReferences(references);
}

async function parseMarkdownEvents(source) {
  micromarkPromise ||= import("micromark");
  const { parse, postprocess, preprocess } = await micromarkPromise;
  return postprocess(parse().document().write(preprocess()(source, undefined, true)));
}

function referenceFromToken(source, token, mode) {
  return {
    start: token.start.offset,
    end: token.end.offset,
    href: source.slice(token.start.offset, token.end.offset),
    mode
  };
}

function smallestContainer(token, containers) {
  return containers
    .filter((container) => contains(container, token))
    .sort((left, right) => (left.end.offset - left.start.offset) - (right.end.offset - right.start.offset))[0];
}

function containedToken(container, tokens, type) {
  return tokens.find((token) => token.type === type && contains(container, token));
}

function contains(container, token) {
  return token.start.offset >= container.start.offset && token.end.offset <= container.end.offset;
}

function normalizeIdentifier(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function htmlFileReferences(source, token) {
  const html = source.slice(token.start.offset, token.end.offset);
  const references = [];
  const tagPattern = /<[A-Za-z][^>]*>/g;
  for (const tagMatch of html.matchAll(tagPattern)) {
    const tag = tagMatch[0];
    const attributePattern = /\b(srcset|src|href|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gid;
    for (const attribute of tag.matchAll(attributePattern)) {
      const valueGroup = attribute[2] !== undefined ? 2 : attribute[3] !== undefined ? 3 : 4;
      const value = attribute[valueGroup] || "";
      const valueRange = attribute.indices?.[valueGroup];
      if (!value || !valueRange) continue;
      const start = token.start.offset + (tagMatch.index || 0) + valueRange[0];
      const mode = attribute[1].toLocaleLowerCase() === "href" ? "link" : "media";
      if (attribute[1].toLocaleLowerCase() === "srcset") {
        references.push(...srcsetCandidates(value).map((candidate) => ({
          start: start + candidate.start,
          end: start + candidate.end,
          href: candidate.href,
          mode
        })));
      } else {
        references.push({ start, end: start + value.length, href: value, mode });
      }
    }
  }
  return references;
}

function srcsetCandidates(value) {
  const candidates = [];
  let offset = 0;
  while (offset < value.length) {
    while (offset < value.length && /[\s,]/.test(value[offset])) offset += 1;
    if (offset >= value.length) break;
    const start = offset;
    while (offset < value.length && !/\s/.test(value[offset])) offset += 1;
    let end = offset;
    while (end > start && value[end - 1] === ",") end -= 1;
    if (end > start) candidates.push({ start, end, href: value.slice(start, end) });
    if (end !== offset) continue;
    let parentheses = 0;
    while (offset < value.length) {
      if (value[offset] === "(") parentheses += 1;
      else if (value[offset] === ")" && parentheses) parentheses -= 1;
      else if (value[offset] === "," && !parentheses) { offset += 1; break; }
      offset += 1;
    }
  }
  return candidates;
}

function uniqueReferences(references) {
  const seen = new Set();
  return references
    .filter((reference) => {
      const key = `${reference.start}:${reference.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.start - right.start);
}

module.exports = { findMarkdownFileReferences, srcsetCandidates };
