import { NextResponse } from "next/server";

import type { AiEditorContext } from "@/features/mermaid-editor/lib/ai-context";
import { getLatestAiEditorContext, setLatestAiEditorContext, aiContextDiagnostic } from "@/features/mermaid-editor/lib/ai-context-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getLatestAiEditorContext());
}

export async function POST(request: Request) {
  try {
    const context = await request.json();
    if (!isAiEditorContext(context)) {
      return NextResponse.json(
        {
          ok: false,
          diagnostics: [aiContextDiagnostic("INVALID_EDITOR_CONTEXT", "上报的编辑器上下文格式无效。")]
        },
        { status: 400 }
      );
    }

    setLatestAiEditorContext(context);
    return NextResponse.json({ ok: true, diagnostics: [] });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        diagnostics: [aiContextDiagnostic("INVALID_JSON", "请求体不是有效的 JSON。")]
      },
      { status: 400 }
    );
  }
}

function isAiEditorContext(value: unknown): value is AiEditorContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<AiEditorContext>;
  return context.version === 1 && typeof context.updatedAt === "string" && typeof context.ttlMs === "number" && Boolean(context.document);
}
