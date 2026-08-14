import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XtermTerminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import { TerminalHistoryScrollArea } from "@/features/mermaid-editor/components/terminal-history-scroll-area";
import type { EditorRuntime, RuntimeTerminalSession } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorTheme, XtermThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { fitTerminalWithoutNativeScrollbar } from "@/features/mermaid-editor/lib/terminal-fit";
import { createTerminalClipboardKeyHandler, isMacPlatform } from "@/features/mermaid-editor/lib/terminal-clipboard-shortcuts";
import { cn } from "@/lib/utils";

export type TerminalSessionPhase = "idle" | "opening" | "running" | "exited" | "unsupported" | "error";

export type TerminalSessionPaneMeta = {
  busy: boolean;
  phase: TerminalSessionPhase;
  session: RuntimeTerminalSession | null;
};

export type TerminalSessionPaneHandle = {
  clear: () => void;
  focus: () => void;
  restart: (shellId?: string) => Promise<void>;
};

type TerminalSessionPaneProps = {
  runtime: EditorRuntime;
  cwd?: string;
  shellId: string;
  active: boolean;
  visible: boolean;
  theme: EditorTheme;
  terminalTheme: XtermThemeTokens;
  onMetaChange: (meta: TerminalSessionPaneMeta) => void;
  onStatus: (message: string) => void;
};

export const TerminalSessionPane = forwardRef<TerminalSessionPaneHandle, TerminalSessionPaneProps>(function TerminalSessionPane({
  runtime,
  cwd,
  shellId,
  active,
  visible,
  theme,
  terminalTheme,
  onMetaChange,
  onStatus
}, ref) {
  const terminalTypography = theme.typography.terminal.content;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<RuntimeTerminalSession | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const runtimeRef = useRef(runtime);
  const cwdRef = useRef(cwd);
  const shellIdRef = useRef(shellId);
  const visibleRef = useRef(visible);
  const activeRef = useRef(active);
  const onStatusRef = useRef(onStatus);
  const openSessionRef = useRef<() => Promise<void>>(async () => undefined);
  const initializedRef = useRef(false);
  const openingRef = useRef(false);
  const disposedRef = useRef(false);
  const sessionGenerationRef = useRef(0);
  const phaseRef = useRef<TerminalSessionPhase>("idle");
  const initialOptionsRef = useRef({
    fontFamily: terminalTypography.family,
    fontSize: terminalTypography.fontSize,
    fontWeight: terminalTypography.fontWeight,
    letterSpacing: terminalTypography.letterSpacing,
    lineHeight: Math.max(1, terminalTypography.lineHeight / terminalTypography.fontSize),
    terminalTheme
  });
  const [terminalInstance, setTerminalInstance] = useState<XtermTerminal | null>(null);
  const [session, setSession] = useState<RuntimeTerminalSession | null>(null);
  const [phase, setPhase] = useState<TerminalSessionPhase>("idle");
  const [busy, setBusy] = useState(false);

  const lineHeightRatio = useMemo(
    () => Math.max(1, terminalTypography.lineHeight / terminalTypography.fontSize),
    [terminalTypography.fontSize, terminalTypography.lineHeight]
  );

  const updatePhase = useCallback((nextPhase: TerminalSessionPhase) => {
    phaseRef.current = nextPhase;
    if (!disposedRef.current) setPhase(nextPhase);
  }, []);

  const scheduleFitAndResize = useCallback(() => {
    if (!visibleRef.current || !activeRef.current) return;
    if (resizeFrameRef.current !== null) window.cancelAnimationFrame(resizeFrameRef.current);
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null;
      const terminal = terminalRef.current;
      const fitAddon = fitAddonRef.current;
      const activeSession = sessionRef.current;
      if (!terminal || !fitAddon) return;
      try {
        fitTerminalWithoutNativeScrollbar(terminal, fitAddon);
        if (activeSession && terminal.cols > 0 && terminal.rows > 0) {
          void runtimeRef.current.resizeTerminal(activeSession.sessionId, terminal.cols, terminal.rows);
        }
      } catch {
        // A hidden terminal may be measured while the floating panel is closing.
      }
    });
  }, []);

  const openSession = useCallback(async () => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon || openingRef.current || sessionRef.current) return;
    const generation = sessionGenerationRef.current;
    openingRef.current = true;
    updatePhase("opening");
    if (!disposedRef.current) setBusy(true);
    try {
      terminal.reset();
      if (visibleRef.current && activeRef.current) fitTerminalWithoutNativeScrollbar(terminal, fitAddon);
      const result = await runtimeRef.current.openTerminal({
        cwd: cwdRef.current,
        shellId: shellIdRef.current,
        cols: terminal.cols || 80,
        rows: terminal.rows || 24
      });
      if (generation !== sessionGenerationRef.current || disposedRef.current) {
        if (result.status === "opened") await runtimeRef.current.closeTerminal(result.session.sessionId).catch(() => undefined);
        return;
      }
      if (result.status === "unsupported") {
        terminal.write(`${result.message}\r\n`);
        updatePhase("unsupported");
        onStatusRef.current(result.message);
        return;
      }
      sessionRef.current = result.session;
      setSession(result.session);
      updatePhase("running");
      onStatusRef.current("终端已启动。");
      scheduleFitAndResize();
    } catch (error) {
      if (generation !== sessionGenerationRef.current || disposedRef.current) return;
      const message = `终端启动失败：${error instanceof Error ? error.message : String(error)}`;
      terminal.write(`${message}\r\n`);
      updatePhase("error");
      onStatusRef.current(message);
    } finally {
      openingRef.current = false;
      if (!disposedRef.current) setBusy(false);
    }
  }, [scheduleFitAndResize, updatePhase]);

  openSessionRef.current = openSession;

  useImperativeHandle(ref, () => ({
    clear() {
      terminalRef.current?.clear();
    },
    focus() {
      terminalRef.current?.focus();
    },
    async restart(nextShellId) {
      if (nextShellId) shellIdRef.current = nextShellId;
      sessionGenerationRef.current += 1;
      const activeSession = sessionRef.current;
      sessionRef.current = null;
      setSession(null);
      if (activeSession) await runtimeRef.current.closeTerminal(activeSession.sessionId).catch(() => undefined);
      terminalRef.current?.reset();
      updatePhase("idle");
      await openSessionRef.current();
    }
  }), [updatePhase]);

  useEffect(() => {
    onMetaChange({ busy, phase, session });
  }, [busy, onMetaChange, phase, session]);

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  useEffect(() => {
    cwdRef.current = cwd;
  }, [cwd]);

  useEffect(() => {
    shellIdRef.current = shellId;
  }, [shellId]);

  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    visibleRef.current = visible;
    activeRef.current = active;
    if (!visible) return;
    if (phaseRef.current === "idle" && initializedRef.current) void openSessionRef.current();
    if (!active) return;
    scheduleFitAndResize();
    terminalRef.current?.focus();
  }, [active, scheduleFitAndResize, visible]);

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

    disposedRef.current = false;
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
    terminal.attachCustomKeyEventHandler(createTerminalClipboardKeyHandler({
      terminal,
      readText: () => runtimeRef.current.readClipboardText(),
      writeText: (text) => runtimeRef.current.writeClipboardText(text),
      isMac: isMacPlatform(),
      isActive: () => !disposedRef.current,
      onError: (error) => onStatusRef.current(`终端剪贴板操作失败：${error instanceof Error ? error.message : String(error)}`)
    }));
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setTerminalInstance(terminal);

    const dataDisposable = terminal.onData((data) => {
      const activeSession = sessionRef.current;
      if (!activeSession) return;
      void runtimeRef.current.writeTerminal(activeSession.sessionId, data).catch(() => {
        terminal.write("\r\n终端写入失败。\r\n");
      });
    });

    const resizeObserver = new ResizeObserver(scheduleFitAndResize);
    resizeObserver.observe(container);

    async function setup() {
      const nextUnlistenData = await runtimeRef.current.listenForTerminalData((event) => {
        if (disposedRef.current || event.sessionId !== sessionRef.current?.sessionId) return;
        terminal.write(event.data);
      });
      if (disposedRef.current) {
        nextUnlistenData();
        return;
      }
      unlistenData = nextUnlistenData;
      const nextUnlistenExit = await runtimeRef.current.listenForTerminalExit((event) => {
        if (disposedRef.current || event.sessionId !== sessionRef.current?.sessionId) return;
        sessionRef.current = null;
        setSession(null);
        setBusy(false);
        updatePhase("exited");
        terminal.write(`\r\n终端已退出${typeof event.exitCode === "number" ? `，退出码 ${event.exitCode}` : ""}。\r\n`);
      });
      if (disposedRef.current) {
        nextUnlistenExit();
        unlistenData?.();
        unlistenData = null;
        return;
      }
      unlistenExit = nextUnlistenExit;
      initializedRef.current = true;
      if (visibleRef.current && phaseRef.current === "idle") await openSessionRef.current();
    }

    void setup().catch((error) => {
      if (disposedRef.current) return;
      const message = `终端启动失败：${error instanceof Error ? error.message : String(error)}`;
      terminal.write(`${message}\r\n`);
      updatePhase("error");
    });

    return () => {
      disposedRef.current = true;
      initializedRef.current = false;
      sessionGenerationRef.current += 1;
      if (resizeFrameRef.current !== null) window.cancelAnimationFrame(resizeFrameRef.current);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      unlistenData?.();
      unlistenData = null;
      unlistenExit?.();
      unlistenExit = null;
      const activeSession = sessionRef.current;
      sessionRef.current = null;
      if (activeSession) void runtimeRef.current.closeTerminal(activeSession.sessionId);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [scheduleFitAndResize, updatePhase]);

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden rounded-sm"
      style={{ backgroundColor: terminalTheme.background, color: terminalTheme.foreground }}
    >
      <div ref={containerRef} className={cn("h-full min-h-0 overflow-hidden", runtime.kind !== "desktop" && "opacity-80")} />
      <TerminalHistoryScrollArea terminal={terminalInstance} />
    </div>
  );
});
