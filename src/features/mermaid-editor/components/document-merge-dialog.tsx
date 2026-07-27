import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { RuntimeDocumentSnapshot } from "@/features/mermaid-editor/lib/editor-runtime";

type ConflictChoice = "local" | "disk";

export function DocumentMergeDialog({
  snapshot,
  onResolve
}: {
  snapshot: RuntimeDocumentSnapshot;
  onResolve: (content: string, diskRevision: string | null) => Promise<void>;
}) {
  const conflict = snapshot.conflict!;
  const [choices, setChoices] = useState<ConflictChoice[]>(() => conflict.conflicts.map(() => "local"));
  const [saving, setSaving] = useState(false);
  const resolvedContent = useMemo(() => conflict.conflicts.reduce(
    (content, hunk, index) => content.replace(hunk.token, choices[index] === "disk" ? hunk.disk : hunk.local),
    conflict.resolutionTemplate
  ), [choices, conflict]);

  async function resolve() {
    setSaving(true);
    try {
      await onResolve(resolvedContent, conflict.diskRevision);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(88vh,880px)] w-[min(94vw,1440px)] max-w-none flex-col gap-4 overflow-hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>合并 {snapshot.file.name}</DialogTitle>
          <DialogDescription>磁盘与工作副本修改了相同位置。逐块选择版本，确认后会按最新磁盘 revision 保存。</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
          <MergeColumn title="共同基线" value={conflict.baseContent} />
          <MergeColumn title="当前工作副本" value={conflict.localContent} />
          <MergeColumn title="磁盘或其他窗口版本" value={conflict.diskContent} />
        </div>

        <ScrollArea className="max-h-48 rounded-md border">
          <div className="space-y-2 p-3">
            {conflict.conflicts.map((hunk, index) => (
              <Item key={hunk.token}>
                <ItemContent>
                  <ItemTitle>冲突 {index + 1}</ItemTitle>
                  <ItemDescription><code>{hunk.base || "新增内容"}</code></ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={choices[index]}
                    onValueChange={(choice) => (choice === "local" || choice === "disk") && setChoices((current) => current.map((value, itemIndex) => itemIndex === index ? choice : value))}
                  >
                    <ToggleGroupItem value="local">采用本地</ToggleGroupItem>
                    <ToggleGroupItem value="disk">采用磁盘</ToggleGroupItem>
                  </ToggleGroup>
                </ItemActions>
              </Item>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="items-center sm:justify-between">
          <DialogDescription>已选择 {choices.filter((choice) => choice === "local").length} 个本地块、{choices.filter((choice) => choice === "disk").length} 个磁盘块</DialogDescription>
          <Button disabled={saving} onClick={() => void resolve()}>
            {saving ? <><Spinner data-icon="inline-start" />正在保存…</> : "应用合并并保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeColumn({ title, value }: { title: string; value: string }) {
  return (
    <section className="flex min-h-0 flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <Textarea className="min-h-0 flex-1 resize-none whitespace-pre font-mono text-xs" readOnly value={value} aria-label={title} />
    </section>
  );
}
