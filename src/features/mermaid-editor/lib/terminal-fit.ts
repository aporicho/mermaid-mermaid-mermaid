import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal as XtermTerminal } from "@xterm/xterm";

type XtermRenderCore = {
  _core?: {
    _renderService?: {
      clear?: () => void;
      dimensions?: {
        css?: {
          cell?: {
            width?: number;
          };
        };
      };
    };
  };
};

const MINIMUM_TERMINAL_COLUMNS = 2;

export function fitTerminalWithoutNativeScrollbar(terminal: XtermTerminal, fitAddon: FitAddon) {
  const proposed = fitAddon.proposeDimensions();
  const terminalElement = terminal.element;
  const parentElement = terminalElement?.parentElement;
  const renderService = (terminal as XtermTerminal & XtermRenderCore)._core?._renderService;
  const cellWidth = renderService?.dimensions?.css?.cell?.width;

  if (!proposed || !terminalElement || !parentElement || !cellWidth || !Number.isFinite(cellWidth)) {
    fitAddon.fit();
    return;
  }

  const parentWidth = Number.parseFloat(window.getComputedStyle(parentElement).width);
  if (!Number.isFinite(parentWidth) || parentWidth <= 0) {
    fitAddon.fit();
    return;
  }

  const terminalStyle = window.getComputedStyle(terminalElement);
  const horizontalPadding = cssPixels(terminalStyle.paddingLeft) + cssPixels(terminalStyle.paddingRight);
  const availableWidth = Math.max(0, parentWidth - horizontalPadding);
  const columns = Math.max(MINIMUM_TERMINAL_COLUMNS, Math.floor(availableWidth / cellWidth));

  if (terminal.cols === columns && terminal.rows === proposed.rows) return;
  renderService?.clear?.();
  terminal.resize(columns, proposed.rows);
}

function cssPixels(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
