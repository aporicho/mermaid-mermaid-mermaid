import { BrowserToolWindow } from "@/features/mermaid-editor/components/browser-tool-window";
import { MermaidEditor } from "@/features/mermaid-editor";
import { parseBrowserToolWindowRequest } from "@/features/mermaid-editor/lib/browser-tool-window";
import { TooltipProvider } from "@/components/ui/tooltip";

export function App() {
  const browserToolRequest = typeof window === "undefined" ? null : parseBrowserToolWindowRequest(window.location);
  if (browserToolRequest) return <TooltipProvider delayDuration={180}><BrowserToolWindow request={browserToolRequest} /></TooltipProvider>;
  return <MermaidEditor />;
}
