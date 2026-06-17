import { NextResponse } from "next/server";

import { getAiCommandResult } from "@/features/mermaid-editor/lib/ai-command-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = getAiCommandResult(id);

  return NextResponse.json({
    ok: true,
    status: result ? "completed" : "pending",
    ...(result ? { result } : {}),
    diagnostics: result?.diagnostics || []
  });
}
