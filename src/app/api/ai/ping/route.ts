import { NextResponse } from "next/server";

import { getLatestAiEditorContext } from "@/features/mermaid-editor/lib/ai-context-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = getLatestAiEditorContext();
  return NextResponse.json({
    ok: true,
    editorContext: {
      available: Boolean(response.context),
      stale: response.context?.stale ?? true,
      updatedAt: response.context?.updatedAt
    },
    diagnostics: response.diagnostics
  });
}
