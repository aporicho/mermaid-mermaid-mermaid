import { useEffect, useState } from "react";
import { CodeBrackets, Copy, Refresh as RefreshCw } from "iconoir-react/regular";

import { Spinner } from "@/components/ui/spinner";
import { EditorIconButton } from "@/features/mermaid-editor/components/editor-ui";
import { EmbeddedBrowserSurface } from "@/features/mermaid-editor/components/embedded-browser-surface";
import { WorkspaceNativeSurfaceFrame, WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import type { EditorRuntime, RuntimeEmbeddedBrowserHandle, RuntimeEmbeddedBrowserState } from "@/features/mermaid-editor/lib/editor-runtime";
import type { DetachedHtmlWindow } from "@/features/mermaid-editor/lib/workspace-panels";

export function HtmlWindowPanel({
  htmlWindow,
  runtime,
  onFocusPanel,
  onStatus
}: {
  htmlWindow: DetachedHtmlWindow;
  runtime: EditorRuntime;
  onFocusPanel: () => void;
  onStatus: (message: string) => void;
}) {
  const [pageTitle, setPageTitle] = useState(htmlWindow.title);
  const [localStatus, setLocalStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryRevision, setRetryRevision] = useState(0);
  const [browserHandle, setBrowserHandle] = useState<RuntimeEmbeddedBrowserHandle | null>(null);

  useEffect(() => {
    if (!localStatus) return;
    const timer = window.setTimeout(() => setLocalStatus(""), 2400);
    return () => window.clearTimeout(timer);
  }, [localStatus]);

  useEffect(() => {
    if (!htmlWindow.revision) return;
    if (htmlWindow.missing) {
      reportStatus(`${htmlWindow.title} 已从磁盘移除。`);
      return;
    }
    reloadPreview();
    // The file watcher revision is the reload signal; the native handle is intentionally read at effect time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlWindow.missing, htmlWindow.revision]);

  function reportStatus(message: string) {
    setLocalStatus(message);
    onStatus(message);
  }

  function reloadPreview() {
    if (!browserHandle) {
      setRetryRevision((current) => current + 1);
      return;
    }
    void browserHandle.reload().catch((error) => reportStatus(`重新载入失败：${readableError(error)}`));
  }

  function updateBrowserState(state: RuntimeEmbeddedBrowserState) {
    setLoading(state.loading);
    setPageTitle(state.title || htmlWindow.title);
  }

  function copyPath() {
    void navigator.clipboard?.writeText(htmlWindow.file.path);
    reportStatus("已复制 HTML 文件路径。");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <WorkspaceWindowHeader
        icon={<CodeBrackets className="size-4 shrink-0 text-icon" />}
        title={<span className="block max-w-56 truncate">{pageTitle}</span>}
        titleTooltip={`${pageTitle}\n${htmlWindow.file.path}`}
        status={localStatus
          ? <span className="type-interface-status hidden max-w-40 truncate text-muted-foreground xl:block" aria-live="polite">{localStatus}</span>
          : loading ? <span className="type-interface-status hidden items-center gap-1.5 text-muted-foreground xl:flex"><Spinner className="size-3.5" />载入中</span> : null}
        center={<span className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground" title={htmlWindow.file.path}>{htmlWindow.file.path}</span>}
        actions={<>
          <EditorIconButton context="panel" label="重新载入 HTML" onClick={reloadPreview}><RefreshCw /></EditorIconButton>
          <EditorIconButton context="panel" label="复制文件路径" onClick={copyPath}><Copy /></EditorIconButton>
        </>}
      />
      <WorkspaceNativeSurfaceFrame>
        <EmbeddedBrowserSurface
          panelId={htmlWindow.id}
          url={htmlWindow.url}
          runtime={runtime}
          retryRevision={retryRevision}
          onRetry={reloadPreview}
          onStatus={reportStatus}
          onBrowserError={(_url, message) => reportStatus(`HTML 预览失败：${message}`)}
          onBrowserFocus={onFocusPanel}
          onBrowserHandleChange={(_panelId, handle) => setBrowserHandle(handle)}
          onBrowserStateChange={updateBrowserState}
        />
      </WorkspaceNativeSurfaceFrame>
    </div>
  );
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
