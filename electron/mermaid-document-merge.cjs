const { isDeepStrictEqual } = require("node:util");

const CANVAS_LAYOUT_PREFIX = "%% canvas-layout:";
const LAYOUT_CONFLICT_NAMESPACE = "MMM_LAYOUT_CONFLICT";
const ABSENT = Symbol("absent");

function mergeMermaidDocument(baseText, localText, diskText, mergeBody) {
  if (typeof mergeBody !== "function") throw new TypeError("mergeMermaidDocument requires a body merge function.");

  const base = parseMermaidDocument(baseText);
  const local = parseMermaidDocument(localText);
  const disk = parseMermaidDocument(diskText);
  if (!base || !local || !disk) return null;

  const bodyMerge = mergeBody(base.body, local.body, disk.body);
  const layoutMerge = mergeCanvasLayouts(base.layout, local.layout, disk.layout);
  const resolutionTemplate = `${CANVAS_LAYOUT_PREFIX} ${JSON.stringify(layoutMerge.layout)}\n${bodyMerge.resolutionTemplate}`;
  const conflicts = [...layoutMerge.conflicts, ...bodyMerge.conflicts];

  return {
    text: conflicts.length ? localText : resolutionTemplate,
    conflicts,
    resolutionTemplate
  };
}

function normalizeMermaidLayoutDocument(text) {
  const parsed = parseMermaidDocument(text);
  if (!parsed) return text;

  const layout = { ...parsed.layout };
  layout.nodes = cleanRecord(layout.nodes);
  if (isObject(layout.edges)) {
    const edges = cleanRecord(layout.edges);
    if (Object.keys(edges).length) layout.edges = edges;
    else delete layout.edges;
  }
  if (layout.edgeRouting == null) delete layout.edgeRouting;
  if (layout.layoutMode == null) delete layout.layoutMode;

  return `${CANVAS_LAYOUT_PREFIX} ${JSON.stringify(layout)}\n${parsed.body}`;
}

function mergeCanvasLayouts(base, local, disk) {
  const conflicts = [];
  const createConflict = (kind, label, baseValue, localValue, diskValue) => {
    const marker = `\uE000${LAYOUT_CONFLICT_NAMESPACE}_${conflicts.length}\uE001`;
    conflicts.push({
      start: 0,
      end: 1,
      base: serializeChoice(baseValue),
      local: serializeChoice(localValue),
      disk: serializeChoice(diskValue),
      token: JSON.stringify(marker),
      kind,
      label
    });
    return marker;
  };

  const layout = { version: 1 };
  assignMergedScalar(layout, "edgeRouting", base, local, disk, createConflict, "canvas-setting", "连线路由方式");
  assignMergedScalar(layout, "layoutMode", base, local, disk, createConflict, "canvas-setting", "布局模式");

  const mergedEdges = mergeEntryRecord(
    propertyValue(base, "edges", {}),
    propertyValue(local, "edges", {}),
    propertyValue(disk, "edges", {}),
    (id, baseValue, localValue, diskValue) => mergeObjectEntry(
      baseValue,
      localValue,
      diskValue,
      (resolvedBase, resolvedLocal, resolvedDisk) => createConflict("canvas-edge-layout", `连线 ${id} 的布局`, resolvedBase, resolvedLocal, resolvedDisk)
    )
  );
  if (Object.keys(mergedEdges).length) layout.edges = mergedEdges;

  // Viewport is interaction state. During a merge the active working copy is
  // authoritative so applying the merged document never moves the user's view.
  layout.viewport = cloneValue(local.viewport);
  layout.nodes = mergeEntryRecord(base.nodes, local.nodes, disk.nodes, (id, baseValue, localValue, diskValue) => (
    mergeNodeEntry(id, baseValue, localValue, diskValue, createConflict)
  ));

  const knownKeys = new Set(["version", "edgeRouting", "layoutMode", "edges", "viewport", "nodes"]);
  for (const key of orderedKeys(base, local, disk)) {
    if (knownKeys.has(key)) continue;
    assignMergedScalar(layout, key, base, local, disk, createConflict, "canvas-setting", `画布设置 ${key}`);
  }

  return { layout, conflicts };
}

function mergeNodeEntry(id, baseValue, localValue, diskValue, createConflict) {
  if (baseValue === ABSENT || localValue === ABSENT || diskValue === ABSENT) {
    const outcome = mergeAtomic(baseValue, localValue, diskValue);
    if (!outcome.conflict) return outcome.value;
    return createConflict("canvas-node-layout", `节点 ${id} 的布局`, baseValue, localValue, diskValue);
  }

  if (!isObject(baseValue) || !isObject(localValue) || !isObject(diskValue)) {
    const outcome = mergeAtomic(baseValue, localValue, diskValue);
    return outcome.conflict
      ? createConflict("canvas-node-layout", `节点 ${id} 的布局`, baseValue, localValue, diskValue)
      : outcome.value;
  }

  const groups = [];
  groups.push({
    key: "position",
    base: { x: baseValue.x, y: baseValue.y },
    local: { x: localValue.x, y: localValue.y },
    disk: { x: diskValue.x, y: diskValue.y }
  });
  for (const key of orderedKeys(baseValue, localValue, diskValue)) {
    if (key === "x" || key === "y") continue;
    groups.push({
      key,
      base: propertyValue(baseValue, key),
      local: propertyValue(localValue, key),
      disk: propertyValue(diskValue, key)
    });
  }

  const outcomes = groups.map((group) => ({ ...group, outcome: mergeAtomic(group.base, group.local, group.disk) }));
  const conflicting = outcomes.filter((group) => group.outcome.conflict);
  if (!conflicting.length) return composeNode(outcomes, "merged");

  const positionOnly = conflicting.length === 1 && conflicting[0].key === "position";
  return createConflict(
    positionOnly ? "canvas-node-position" : "canvas-node-layout",
    positionOnly ? `节点 ${id} 的位置` : `节点 ${id} 的布局`,
    composeNode(outcomes, "base"),
    composeNode(outcomes, "local"),
    composeNode(outcomes, "disk")
  );
}

function composeNode(groups, choice) {
  const node = {};
  for (const group of groups) {
    const value = group.outcome.conflict
      ? group[choice]
      : group.outcome.value;
    if (value === ABSENT) continue;
    if (group.key === "position") {
      node.x = value.x;
      node.y = value.y;
    } else {
      node[group.key] = cloneValue(value);
    }
  }
  return node;
}

function mergeObjectEntry(baseValue, localValue, diskValue, createConflict) {
  if (baseValue === ABSENT || localValue === ABSENT || diskValue === ABSENT) {
    const outcome = mergeAtomic(baseValue, localValue, diskValue);
    return outcome.conflict ? createConflict(baseValue, localValue, diskValue) : outcome.value;
  }
  if (!isObject(baseValue) || !isObject(localValue) || !isObject(diskValue)) {
    const outcome = mergeAtomic(baseValue, localValue, diskValue);
    return outcome.conflict ? createConflict(baseValue, localValue, diskValue) : outcome.value;
  }

  const fields = orderedKeys(baseValue, localValue, diskValue).map((key) => {
    const baseField = propertyValue(baseValue, key);
    const localField = propertyValue(localValue, key);
    const diskField = propertyValue(diskValue, key);
    return { key, base: baseField, local: localField, disk: diskField, outcome: mergeAtomic(baseField, localField, diskField) };
  });
  if (!fields.some((field) => field.outcome.conflict)) return composeObject(fields, "merged");
  return createConflict(composeObject(fields, "base"), composeObject(fields, "local"), composeObject(fields, "disk"));
}

function composeObject(fields, choice) {
  const value = {};
  for (const field of fields) {
    const next = field.outcome.conflict ? field[choice] : field.outcome.value;
    if (next !== ABSENT) value[field.key] = cloneValue(next);
  }
  return value;
}

function mergeEntryRecord(base, local, disk, mergeEntry) {
  const merged = {};
  for (const key of orderedKeys(base, local, disk)) {
    const value = mergeEntry(key, propertyValue(base, key), propertyValue(local, key), propertyValue(disk, key));
    if (value !== ABSENT) merged[key] = value;
  }
  return merged;
}

function assignMergedScalar(target, key, base, local, disk, createConflict, kind, label) {
  const baseValue = propertyValue(base, key);
  const localValue = propertyValue(local, key);
  const diskValue = propertyValue(disk, key);
  const outcome = mergeAtomic(baseValue, localValue, diskValue);
  const value = outcome.conflict
    ? createConflict(kind, label, baseValue, localValue, diskValue)
    : outcome.value;
  if (value !== ABSENT) target[key] = cloneValue(value);
}

function mergeAtomic(base, local, disk) {
  if (sameValue(local, disk)) return { conflict: false, value: cloneValue(local) };
  if (sameValue(local, base)) return { conflict: false, value: cloneValue(disk) };
  if (sameValue(disk, base)) return { conflict: false, value: cloneValue(local) };
  return { conflict: true };
}

function parseMermaidDocument(text) {
  if (typeof text !== "string") return null;
  const linePattern = /^[\t ]*%% canvas-layout:[^\r\n]*(?:\r?\n|$)/m;
  const match = linePattern.exec(text);
  if (!match) return null;
  const rawLine = match[0].replace(/\r?\n$/, "");
  const prefixIndex = rawLine.indexOf(CANVAS_LAYOUT_PREFIX);
  if (prefixIndex < 0) return null;

  try {
    const layout = JSON.parse(rawLine.slice(prefixIndex + CANVAS_LAYOUT_PREFIX.length).trim());
    if (!isObject(layout) || layout.version !== 1 || !isObject(layout.nodes) || !validViewport(layout.viewport)) return null;
    return {
      layout,
      body: text.slice(0, match.index) + text.slice(match.index + match[0].length)
    };
  } catch {
    return null;
  }
}

function validViewport(value) {
  return isObject(value)
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && Number.isFinite(value.scale);
}

function cleanRecord(value) {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => isObject(entry)));
}

function orderedKeys(...values) {
  const keys = new Set();
  for (const value of values) {
    if (!isObject(value)) continue;
    for (const key of Object.keys(value)) keys.add(key);
  }
  return [...keys];
}

function propertyValue(value, key, fallback = ABSENT) {
  return isObject(value) && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : fallback;
}

function serializeChoice(value) {
  if (value === ABSENT) return "null";
  return JSON.stringify(value);
}

function sameValue(left, right) {
  if (left === ABSENT || right === ABSENT) return left === right;
  return isDeepStrictEqual(left, right);
}

function cloneValue(value) {
  if (value === ABSENT || value == null || typeof value !== "object") return value;
  return structuredClone(value);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  CANVAS_LAYOUT_PREFIX,
  mergeMermaidDocument,
  normalizeMermaidLayoutDocument,
  parseMermaidDocument
};
