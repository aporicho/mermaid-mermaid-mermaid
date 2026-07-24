import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  normalizeAutoSaveDelay,
  type EditorAutoSaveMode,
  type EditorPreferences
} from "@/features/mermaid-editor/lib/editor-preferences";

export function AutoSavePreference({
  preferences,
  onChange
}: {
  preferences: EditorPreferences;
  onChange: (preferences: EditorPreferences, message: string) => void;
}) {
  return (
    <div data-floating-action-item className="grid gap-2 px-1 py-1">
      <span className="text-xs text-muted-foreground">自动保存</span>
      <Select
        value={preferences.autoSave}
        onValueChange={(value) => onChange(
          { ...preferences, autoSave: value as EditorAutoSaveMode },
          value === "off" ? "已切换为手动保存。" : "自动保存设置已更新。"
        )}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="off">手动保存</SelectItem>
          <SelectItem value="afterDelay">延迟后保存</SelectItem>
          <SelectItem value="onFocusChange">编辑器失焦时</SelectItem>
          <SelectItem value="onWindowChange">窗口失焦时</SelectItem>
        </SelectContent>
      </Select>
      {preferences.autoSave === "afterDelay" ? (
        <label className="grid grid-cols-[1fr_88px] items-center gap-2 text-xs text-muted-foreground">
          延迟（毫秒）
          <Input
            type="number"
            min={250}
            max={10000}
            step={250}
            value={preferences.autoSaveDelay}
            onChange={(event) => onChange(
              { ...preferences, autoSaveDelay: normalizeAutoSaveDelay(event.target.value) },
              "自动保存延迟已更新。"
            )}
          />
        </label>
      ) : null}
    </div>
  );
}
