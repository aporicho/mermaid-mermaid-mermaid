import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Erase, Restart, Terminal as TerminalIcon, Xmark } from "iconoir-react/regular";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditorIconButton, EditorPanelHeader } from "@/features/mermaid-editor/components/editor-ui";
import type { EditorRuntime, RuntimeTerminalSession, RuntimeTerminalShellOption } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorTheme, XtermThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { cn } from "@/lib/utils";

type TerminalPanelProps = {
  runtime: EditorRuntime;
  cwd?: string;
  theme: EditorTheme;
  terminalTheme: XtermThemeTokens;
  onClose: () => void;
  onStatus: (message: string) => void;
  windowControls?: ReactNode;
  className?: string;
};

export function TerminalPanel({ runtime, cwd, theme, terminalTheme, onClose, onStatus, windowControls, className }: TerminalPanelProps) {
  const terminalTypography = theme.typography.terminal.content;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<RuntimeTerminalSession | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const runtimeRef = useRef(runtime);
  const cwdRef = useRef(cwd);
  const shellIdRef = useRef("default");
  const onStatusRef = useRef(onStatus);
  const openSessionRef = useRef<() => Promise<void>>(async () => undefined);
  const initialOptionsRef = useRef({
    fontFamily: terminalTypography.family,
    fontSize: terminalTypography.fontSize,
    fontWeight: terminalTypography.fontWeight,
    letterSpacing: terminalTypography.letterSpacing,
    lineHeight: Math.max(1, terminalTypography.lineHeight / terminalTypography.fontSize),
    terminalTheme
  });
  const [session, setSession] = useState<RuntimeTerminalSession | null>(null);
  const [shellOptions, setShellOptions] = useState<RuntimeTerminalShellOption[]>([]);
  const [selectedShellId, setSelectedShellId] = useState("default");
  const [busy, setBusy] = useState(false);

  const lineHeightRatio = useMemo(
    () => Math.max(1, terminalTypography.lineHeight / terminalTypography.fontSize),
    [terminalTypography.fontSize, terminalTypography.lineHeight]
  );

  const scheduleFitAndResize = useCallback(() => {
    if (resizeFrameRef.current) window.cancelAnimationFrame(resizeFrameRef.current);
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      const terminal = terminalRef.current;
      const fitAddon = fitAddonRef.current;
      const activeSession = sessionRef.current;
      if (!terminal || !fitAddon) return;
      try {
        fitAddon.fit();
        if (activeSession && terminal.cols > 0 && terminal.rows > 0) {
          void runtimeRef.current.resizeTerminal(activeSession.sessionId, terminal.cols, terminal.rows);
        }
      } catch {
        // The terminal may be hidden during app shutdown or panel teardown.
      }
    });
  }, []);

  const openSession = useCallback(async () => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;
    setBusy(true);
    try {
      terminal.reset();
      fitAddon.fit();
      const result = await runtimeRef.current.openTerminal({
        cwd: cwdRef.current,
        shellId: shellIdRef.current,
        cols: terminal.cols || 80,
        rows: terminal.rows || 24
      });
      if (result.status === "unsupported") {
        terminal.write(`${result.message}\r\n`);
        onStatusRef.current(result.message);
        return;
      }
      sessionRef.current = result.session;
      setSession(result.session);
      onStatusRef.current("终端已启动。");
      scheduleFitAndResize();
    } finally {
      setBusy(false);
    }
  }, [scheduleFitAndResize]);

  openSessionRef.current = openSession;

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  useEffect(() => {
    cwdRef.current = cwd;
  }, [cwd]);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = terminalTheme;
    terminal.options.fontFamily = terminalTypography.family;
    terminal.options.fontSize = terminalTypography.fontSize;
    terminal.options.fontWeight = terminalTypography.fontWeight;
    terminal.options.letterSpacing = terminalTypography.letterSpacing;
    terminal.options.lineHeight = lineHeightRatio;
    if (document.fonts?.load) {
      void document.fonts.load(`${terminalTypography.fontWeight} ${terminalTypography.fontSize}px ${terminalTypography.family}`, "中Aa").then(() => {
        terminal.refresh(0, Math.max(0, terminal.rows - 1));
        scheduleFitAndResize();
      }).catch(() => undefined);
    }
    scheduleFitAndResize();
  }, [lineHeightRatio, scheduleFitAndResize, terminalTheme, terminalTypography]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    const terminal = new XtermTerminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: initialOptionsRef.current.fontFamily,
      fontSize: initialOptionsRef.current.fontSize,
      fontWeight: initialOptionsRef.current.fontWeight,
      letterSpacing: initialOptionsRef.current.letterSpacing,
      lineHeight: initialOptionsRef.current.lineHeight,
      scrollback: 5000,
      theme: initialOptionsRef.current.terminalTheme
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const dataDisposable = terminal.onData((data) => {
      const activeSession = sessionRef.current;
      if (!activeSession) return;
      void runtimeRef.current.writeTerminal(activeSession.sessionId, data).catch(() => {
        terminal.write("\r\n终端写入失败。\r\n");
      });
    });

    const resizeObserver = new ResizeObserver(() => scheduleFitAndResize());
    resizeObserver.observe(container);

    async function setup() {
      const nextShellOptions = await runtimeRef.current.listTerminalShells().catch(() => []);
      const availableShellOptions = nextShellOptions.filter((option) => option.available);
      const displayShellOptions = availableShellOptions.length ? availableShellOptions : nextShellOptions;
      setShellOptions(displayShellOptions);
      if (displayShellOptions.length && !displayShellOptions.some((option) => option.id === shellIdRef.current)) {
        shellIdRef.current = displayShellOptions[0].id;
        setSelectedShellId(displayShellOptions[0].id);
      }
      unlistenData = await runtimeRef.current.listenForTerminalData((event) => {
        if (disposed || event.sessionId !== sessionRef.current?.sessionId) return;
        terminal.write(event.data);
      });
      unlistenExit = await runtimeRef.current.listenForTerminalExit((event) => {
        if (event.sessionId !== sessionRef.current?.sessionId) return;
        sessionRef.current = null;
        setSession(null);
        terminal.write(`\r\n终端已退出${typeof event.exitCode === "number" ? `，退出码 ${event.exitCode}` : ""}。\r\n`);
      });
      await openSessionRef.current();
    }

    void setup().catch((error) => {
      terminal.write(`终端启动失败：${error instanceof Error ? error.message : String(error)}\r\n`);
    });

    return () => {
      disposed = true;
      if (resizeFrameRef.current) window.cancelAnimationFrame(resizeFrameRef.current);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      const activeSession = sessionRef.current;
      sessionRef.current = null;
      if (activeSession) void runtimeRef.current.closeTerminal(activeSession.sessionId);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [scheduleFitAndResize]);

  async function restartSession() {
    const activeSession = sessionRef.current;
    if (activeSession) await runtimeRef.current.closeTerminal(activeSession.sessionId).catch(() => undefined);
    sessionRef.current = null;
    setSession(null);
    await openSession();
  }

  async function changeShell(value: string) {
    if (value === shellIdRef.current) return;
    shellIdRef.current = value;
    setSelectedShellId(value);
    await restartSession();
  }

  function clearTerminal() {
    terminalRef.current?.clear();
  }

  return (
    <section
      className={cn("terminal-panel flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/[var(--ui-surface-opacity)]", className)}
      data-editor-floating-menu-ignore
    >
      <EditorPanelHeader className="cursor-grab active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2" title={session?.cwd || cwd || "桌面终端"}>
          <TerminalIcon className="size-4 shrink-0 text-icon" />
          <div className="terminal-heading truncate text-foreground">终端</div>
        </div>
        <div className="flex items-center gap-2">
          {shellOptions.length > 1 ? (
            <Select value={selectedShellId} onValueChange={(value) => void changeShell(value)} disabled={busy || runtime.kind !== "desktop"}>
              <SelectTrigger className="w-[132px] bg-background/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shellOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <PanelIconButton label="重启终端" disabled={busy || runtime.kind !== "desktop"} onClick={() => void restartSession()}>
            <Restart />
          </PanelIconButton>
          <PanelIconButton label="清空终端" onClick={clearTerminal}>
            <Erase />
          </PanelIconButton>
          {windowControls ?? (
            <PanelIconButton label="关闭终端" onClick={onClose}>
              <Xmark />
            </PanelIconButton>
          )}
        </div>
      </EditorPanelHeader>
      <div className="min-h-0 flex-1 p-2" style={{ backgroundColor: terminalTheme.background, color: terminalTheme.foreground }}>
        <div ref={containerRef} className={cn("h-full min-h-0 overflow-hidden rounded-sm", runtime.kind !== "desktop" && "opacity-80")} />
      </div>
    </section>
  );
}

function PanelIconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <EditorIconButton context="panel" label={label} tooltipSide="top" {...props}>{children}</EditorIconButton>;
}
