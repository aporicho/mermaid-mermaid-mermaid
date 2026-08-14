export type TerminalClipboardTarget = {
  hasSelection: () => boolean;
  getSelection: () => string;
  paste: (text: string) => void;
  focus: () => void;
};

export function createTerminalClipboardKeyHandler({ terminal, readText, writeText, isMac, isActive = () => true, onError = () => undefined }: {
  terminal: TerminalClipboardTarget;
  readText: () => Promise<string>;
  writeText: (text: string) => Promise<void>;
  isMac: boolean;
  isActive?: () => boolean;
  onError?: (error: unknown) => void;
}) {
  return (event: KeyboardEvent) => {
    if (event.type !== "keydown") return true;
    const key = event.key.toLowerCase();
    const commandShortcut = isMac && event.metaKey && !event.ctrlKey && !event.altKey;
    const terminalShortcut = !isMac && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
    const copy = key === "c" && (commandShortcut || terminalShortcut);
    const paste = key === "v" && (commandShortcut || terminalShortcut)
      || key === "insert" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
    if (copy) {
      if (terminal.hasSelection()) void writeText(terminal.getSelection()).catch(onError);
      return false;
    }
    if (paste) {
      void readText().then((text) => {
        if (!text || !isActive()) return;
        terminal.paste(text);
        terminal.focus();
      }).catch(onError);
      return false;
    }
    return true;
  };
}

export function isMacPlatform() {
  return typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);
}
