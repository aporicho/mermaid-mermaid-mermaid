export { applyMermaidPatch } from "@/features/mermaid-editor/lib/mermaid-patch/apply";
export {
  buildSourceFromDocument,
  diffDocuments,
  graphSummary
} from "@/features/mermaid-editor/lib/mermaid-patch/diff";
export { patchDiagnostic } from "@/features/mermaid-editor/lib/mermaid-patch/diagnostics";
export type {
  DiffResult,
  GraphSummary,
  MermaidPatchEnvelope,
  MermaidPatchResult,
  PatchInput,
  PatchOperation
} from "@/features/mermaid-editor/lib/mermaid-patch/types";
