import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";
import { MIXED_VALUE } from "@/features/mermaid-editor/components/inspector-panel/constants";
import { palette } from "@/features/mermaid-editor/lib/mermaid-graph";
import { cn } from "@/lib/utils";

export function ColorGrid({ activeFill, mixed = false, onPick }: { activeFill: string; mixed?: boolean; onPick: (fill: string) => void }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>颜色</Label>
        {mixed ? <span className="text-xs text-muted-foreground">混合</span> : null}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`选择颜色 ${color}`}
            className={cn("h-8 rounded-md border-2", activeFill === color ? "border-foreground" : "border-border")}
            style={{ backgroundColor: color }}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyInspector() {
  return (
    <div className="text-sm leading-6 text-muted-foreground">
      <p>选择节点、组或连线后，可以编辑文本、颜色和连接关系。</p>
    </div>
  );
}

export function MixedSelectItem({ mixed }: { mixed: boolean }) {
  return mixed ? (
    <SelectItem value={MIXED_VALUE} disabled>
      混合
    </SelectItem>
  ) : null;
}
