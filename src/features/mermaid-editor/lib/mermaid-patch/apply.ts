import { normalizeMermaidError } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import {
  buildSourceFromDocument,
  diffDocuments,
  graphSummary,
  normalizeDocumentText
} from "@/features/mermaid-editor/lib/mermaid-patch/diff";
import { patchDiagnostic } from "@/features/mermaid-editor/lib/mermaid-patch/diagnostics";
import { applyPatchOperations } from "@/features/mermaid-editor/lib/mermaid-patch/operations";
import type {
  MermaidPatchEnvelope,
  MermaidPatchResult,
  PatchInput,
  PatchOperation
} from "@/features/mermaid-editor/lib/mermaid-patch/types";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";

export function applyMermaidPatch(source: string, input: PatchInput, options: { write?: boolean } = {}): MermaidPatchEnvelope {
  try {
    const document = loadMermaidDocument(source);
    const ops = normalizePatchInput(input);
    if (!ops) {
      return patchEnvelope(false, undefined, [patchDiagnostic("INVALID_PATCH_INPUT", "Patch 输入必须是操作数组，或包含 ops 数组的对象。")]);
    }

    if (document.editableKind !== "flowchart") {
      return patchEnvelope(false, undefined, [
        patchDiagnostic(
          "UNSUPPORTED_DIAGRAM_TYPE",
          `当前命令只支持 flowchart，可读取但不能结构化修改 ${document.diagramType} 图。`,
          "对非 flowchart 图先使用 read/validate，或在源码层手动修改。"
        )
      ]);
    }

    const result = applyPatchOperations(document, ops);
    if (result.diagnostics.length) return patchEnvelope(false, undefined, result.diagnostics);

    const nextSource = buildSourceFromDocument(document, result.graph, result.viewport, result.edgeRouting, result.layoutMode);
    const nextDocument = loadMermaidDocument(nextSource);

    return patchEnvelope(
      true,
      {
        source: nextSource,
        changed: nextSource !== normalizeDocumentText(source),
        written: Boolean(options.write),
        diff: diffDocuments(document, nextDocument),
        graph: graphSummary(nextDocument.graph)
      },
      []
    );
  } catch (error) {
    return patchEnvelope(false, undefined, [normalizeMermaidError(error, source, "serializer")]);
  }
}

function patchEnvelope(ok: boolean, result: MermaidPatchResult | undefined, diagnostics: EditorDiagnostic[]): MermaidPatchEnvelope {
  return {
    ok,
    ...(result === undefined ? {} : { result }),
    diagnostics
  };
}

function normalizePatchInput(input: PatchInput): PatchOperation[] | null {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray(input.ops)) return input.ops;
  return null;
}
