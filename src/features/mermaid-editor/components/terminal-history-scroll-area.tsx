import { useCallback, useEffect, useRef } from "react";
import type { Terminal as XtermTerminal } from "@xterm/xterm";

import { ScrollArea } from "@/components/ui/scroll-area";

export function TerminalHistoryScrollArea({ terminal }: { terminal: XtermTerminal | null }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const syncFromTerminal = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const viewport = viewportRef.current;
      const spacer = spacerRef.current;
      if (!terminal || !viewport || !spacer || viewport.clientHeight <= 0) return;

      const rows = Math.max(1, terminal.rows);
      const lineHeight = viewport.clientHeight / rows;
      const buffer = terminal.buffer.active;
      const scrollHeight = viewport.clientHeight + Math.max(0, buffer.baseY) * lineHeight;
      spacer.style.height = `${Math.max(viewport.clientHeight, scrollHeight)}px`;

      const nextScrollTop = Math.max(0, buffer.viewportY) * lineHeight;
      if (Math.abs(viewport.scrollTop - nextScrollTop) > 0.5) viewport.scrollTop = nextScrollTop;
    });
  }, [terminal]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!terminal || !viewport) return;

    const scrollDisposable = terminal.onScroll(syncFromTerminal);
    const writeDisposable = terminal.onWriteParsed(syncFromTerminal);
    const resizeDisposable = terminal.onResize(syncFromTerminal);
    const renderDisposable = terminal.onRender(syncFromTerminal);
    const resizeObserver = new ResizeObserver(syncFromTerminal);
    resizeObserver.observe(viewport);
    syncFromTerminal();

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      resizeObserver.disconnect();
      scrollDisposable.dispose();
      writeDisposable.dispose();
      resizeDisposable.dispose();
      renderDisposable.dispose();
    };
  }, [syncFromTerminal, terminal]);

  function scrollTerminal() {
    const viewport = viewportRef.current;
    if (!terminal || !viewport || viewport.clientHeight <= 0) return;
    const lineHeight = viewport.clientHeight / Math.max(1, terminal.rows);
    const nextLine = Math.max(0, Math.min(terminal.buffer.active.baseY, Math.round(viewport.scrollTop / lineHeight)));
    if (nextLine !== terminal.buffer.active.viewportY) terminal.scrollToLine(nextLine);
  }

  return (
    <ScrollArea
      type="scroll"
      className="terminal-history-scroll-area pointer-events-auto absolute inset-y-0 right-0 w-2.5"
      viewportRef={viewportRef}
      viewportProps={{
        "aria-label": "终端滚动历史",
        onScroll: scrollTerminal,
        tabIndex: -1
      }}
    >
      <div ref={spacerRef} className="min-h-full w-px" aria-hidden data-terminal-scroll-spacer />
    </ScrollArea>
  );
}
