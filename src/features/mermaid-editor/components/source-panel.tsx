"use client";

import { Code as Code2, KeyCommand as Keyboard, SidebarCollapse as PanelLeftClose } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SourcePanelProps = {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onCollapse: () => void;
};

export function SourcePanel({ value, onChange, onRun, onCollapse }: SourcePanelProps) {
  return (
    <section className="grid min-h-0 grid-rows-[42px_minmax(0,1fr)] border-r bg-card">
      <header className="flex items-center justify-between border-b px-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="grid size-8 place-items-center rounded-md text-muted-foreground">
              <Code2 className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Mermaid 源码</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid size-8 place-items-center rounded-md text-muted-foreground">
                <Keyboard className="size-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Ctrl Enter 刷新画布</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8" onClick={onCollapse} aria-label="收起 Mermaid 面板">
                <PanelLeftClose className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>收起 Mermaid 面板</TooltipContent>
          </Tooltip>
        </div>
      </header>
      <Textarea
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            onRun();
          }
        }}
        className="h-full resize-none rounded-none border-0 bg-[linear-gradient(#fbfcfb_29px,#eef4f2_30px)] bg-[length:100%_30px] p-4 font-mono text-sm leading-[30px] shadow-none focus-visible:ring-0"
      />
    </section>
  );
}
