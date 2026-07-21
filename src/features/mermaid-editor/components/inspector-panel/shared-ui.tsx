import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";
import { MIXED_VALUE } from "@/features/mermaid-editor/components/inspector-panel/constants";
import { EditorEmptyState } from "@/features/mermaid-editor/components/editor-ui";
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
            className={cn("h-8 rounded-[var(--theme-radius-control-sm)]", activeFill === color ? "border-foreground" : "border-border")}
            style={{ backgroundColor: color, borderWidth: activeFill === color ? "max(2px, var(--ui-border-width))" : "var(--ui-border-width)" }}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyInspector() {
  return <EditorEmptyState title="尚未选择对象" />;
}

export function MixedSelectItem({ mixed }: { mixed: boolean }) {
  return mixed ? (
    <SelectItem value={MIXED_VALUE} disabled>
      混合
    </SelectItem>
  ) : null;
}
