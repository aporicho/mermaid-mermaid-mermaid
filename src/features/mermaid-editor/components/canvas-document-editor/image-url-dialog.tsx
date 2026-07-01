import { Xmark } from "iconoir-react/regular";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CanvasDocumentImageUrlDialogProps = {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function CanvasDocumentImageUrlDialog({
  open,
  value,
  onChange,
  onClose,
  onSubmit
}: CanvasDocumentImageUrlDialogProps) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="grid w-[min(420px,100%)] gap-3 rounded-md border bg-card p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">添加图片 URL</div>
            <div className="mt-1 text-xs text-muted-foreground">输入 http、https、data 或本地可访问的图片地址。</div>
          </div>
          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={onClose} aria-label="关闭图片 URL 输入">
            <Xmark className="size-4" />
          </Button>
        </div>
        <Input
          value={value}
          autoFocus
          placeholder="https://example.com/image.png"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={!value.trim()}>
            添加图片
          </Button>
        </div>
      </form>
    </div>
  );
}
