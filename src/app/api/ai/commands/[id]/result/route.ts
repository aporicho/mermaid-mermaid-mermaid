import { NextResponse } from "next/server";

import { aiCommandDiagnostic, setAiCommandResult } from "@/features/mermaid-editor/lib/ai-command-store";
import type { AiApplyResult } from "@/features/mermaid-editor/lib/ai-command-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const body = await request.json();
    if (!isApplyResult(body) || body.commandId !== id) {
      return NextResponse.json(
        {
          ok: false,
          diagnostics: [aiCommandDiagnostic("INVALID_COMMAND_RESULT", "命令结果格式无效。")]
        },
        { status: 400 }
      );
    }

    setAiCommandResult(id, body);
    return NextResponse.json({ ok: true, status: "completed", result: body, diagnostics: body.diagnostics || [] });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        diagnostics: [aiCommandDiagnostic("INVALID_JSON", "请求体不是有效的 JSON。")]
      },
      { status: 400 }
    );
  }
}

function isApplyResult(value: unknown): value is AiApplyResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<AiApplyResult>;
  return typeof result.commandId === "string" && typeof result.applied === "boolean" && typeof result.saved === "boolean" && Array.isArray(result.diagnostics);
}
