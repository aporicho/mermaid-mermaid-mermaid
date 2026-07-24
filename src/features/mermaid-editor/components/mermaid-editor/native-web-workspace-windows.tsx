import { BrowserWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/browser-workspace-windows";
import { HtmlWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/html-workspace-windows";
import { ImageWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/image-workspace-windows";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import type {
  BrowserWindowPanelId,
  DetachedBrowserWindow,
  DetachedHtmlWindow,
  DetachedImageWindow,
  HtmlWindowPanelId,
  ImageWindowPanelId,
  WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

type NativeWebWorkspaceWindowsProps = {
  runtime: EditorRuntime;
  browserWindows: DetachedBrowserWindow[];
  htmlWindows: DetachedHtmlWindow[];
  imageWindows: DetachedImageWindow[];
  titlebarAutoHide: boolean;
  activePanel: WorkspaceFloatingPanelId | null;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  panelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  panelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeBrowserWindow: (panelId: BrowserWindowPanelId) => void;
  closeHtmlWindow: (panelId: HtmlWindowPanelId) => void;
  closeImageWindow: (panelId: ImageWindowPanelId) => void;
  navigateImageWindow: (panelId: ImageWindowPanelId, direction: -1 | 1) => void;
  onStatus: (message: string) => void;
};

export function NativeWebWorkspaceWindows(props: NativeWebWorkspaceWindowsProps) {
  const shared = {
    runtime: props.runtime,
    titlebarAutoHide: props.titlebarAutoHide,
    activePanel: props.activePanel,
    bringPanelToFront: props.bringPanelToFront,
    panelStackPosition: props.panelStackPosition,
    panelWindowState: props.panelWindowState,
    setPanelWindowState: props.setPanelWindowState,
    onStatus: props.onStatus
  };
  return <>
    <BrowserWorkspaceWindows {...shared} browserWindows={props.browserWindows} closeBrowserWindow={props.closeBrowserWindow} />
    <HtmlWorkspaceWindows {...shared} htmlWindows={props.htmlWindows} closeHtmlWindow={props.closeHtmlWindow} />
    <ImageWorkspaceWindows {...shared} imageWindows={props.imageWindows} closeImageWindow={props.closeImageWindow} navigateImageWindow={props.navigateImageWindow} />
  </>;
}
