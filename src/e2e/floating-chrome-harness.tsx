import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  WorkspaceFloatingWindow,
  WorkspaceWindowHeader
} from "@/features/mermaid-editor/components/floating-chrome";

export function FloatingChromeE2EHarness() {
  const [topContentClicks, setTopContentClicks] = useState(0);
  const [titlebarActionClicks, setTitlebarActionClicks] = useState(0);
  const [activeTerminalTab, setActiveTerminalTab] = useState("terminal-one");
  const [closedTerminalTabs, setClosedTerminalTabs] = useState(0);
  const [windowState, setWindowState] = useState<"normal" | "fullscreen">("normal");

  return (
    <TooltipProvider delayDuration={0}>
      <main className="relative h-screen w-screen overflow-hidden bg-background" data-testid="floating-chrome-e2e-root">
        <WorkspaceFloatingWindow
          open
          panelId="floating-chrome-e2e"
          placement="center-panel"
          titlebarAutoHide
          active
          stackIndex={1}
          onFocusPanel={() => undefined}
          defaultSize={{ width: 640, height: 420 }}
          initialFrame={{ x: 220, y: 140, width: 640, height: 420 }}
          initialFrameKey="floating-chrome-e2e"
          minSize={{ width: 320, height: 220 }}
          windowState={windowState}
          onWindowStateChange={setWindowState}
          onClose={() => undefined}
          closeLabel="关闭测试窗口"
        >
          <Tabs value={activeTerminalTab} onValueChange={setActiveTerminalTab} className="h-full min-h-0 gap-0">
            <WorkspaceWindowHeader
              title={<span data-testid="floating-title-drag-target">浮动窗口</span>}
              center={
                <div className="flex min-w-0 flex-1 items-center overflow-x-auto" data-testid="terminal-tab-strip">
                  <TabsList variant="line" className="h-full min-w-max justify-start p-0" aria-label="测试终端会话">
                    {["terminal-one", "terminal-two"].map((value, index) => (
                      <div key={value} className="relative min-w-24 flex-none">
                        <TabsTrigger
                          value={value}
                          className="w-full justify-start pr-8"
                          data-testid={value}
                          data-window-titlebar-drag-allow
                          onMouseDown={(event) => {
                            if (event.button === 0 && !event.ctrlKey) event.preventDefault();
                          }}
                          onClick={() => setActiveTerminalTab(value)}
                        >
                          终端 {index + 1}
                        </TabsTrigger>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          aria-label={`关闭测试终端 ${index + 1}`}
                          onClick={() => setClosedTerminalTabs((count) => count + 1)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </TabsList>
                </div>
              }
              actions={
                <Button type="button" variant="ghost" size="sm" data-testid="floating-titlebar-action" onClick={() => setTitlebarActionClicks((count) => count + 1)}>
                  标题栏操作
                </Button>
              }
            />
            <div className="relative min-h-0 flex-1">
              <button
                type="button"
                className="absolute left-6 top-3"
                data-testid="floating-top-content"
                onClick={() => setTopContentClicks((count) => count + 1)}
              >
                顶部正文操作
              </button>
            </div>
          </Tabs>
        </WorkspaceFloatingWindow>
        <output data-testid="floating-top-content-clicks">{topContentClicks}</output>
        <output data-testid="floating-titlebar-action-clicks">{titlebarActionClicks}</output>
        <output data-testid="active-terminal-tab">{activeTerminalTab}</output>
        <output data-testid="closed-terminal-tabs">{closedTerminalTabs}</output>
      </main>
    </TooltipProvider>
  );
}
