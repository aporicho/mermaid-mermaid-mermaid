import { useId } from "react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const modeId = useId();
  const delayId = useId();
  return (
    <Field data-floating-action-item className="gap-2 px-1 py-1">
      <FieldLabel htmlFor={modeId}>自动保存</FieldLabel>
      <Select
        value={preferences.autoSave}
        onValueChange={(value) => onChange(
          { ...preferences, autoSave: value as EditorAutoSaveMode },
          value === "off" ? "已切换为手动保存。" : "自动保存设置已更新。"
        )}
      >
        <SelectTrigger id={modeId}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="off">手动保存</SelectItem>
            <SelectItem value="afterDelay">延迟后保存</SelectItem>
            <SelectItem value="onFocusChange">编辑器失焦时</SelectItem>
            <SelectItem value="onWindowChange">窗口失焦时</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {preferences.autoSave === "afterDelay" ? (
        <Field orientation="horizontal" className="items-center">
          <FieldLabel htmlFor={delayId}>延迟（毫秒）</FieldLabel>
          <Input
            id={delayId}
            className="w-[88px]"
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
        </Field>
      ) : null}
    </Field>
  );
}
