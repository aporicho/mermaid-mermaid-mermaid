import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorDialog, EditorField } from "@/features/mermaid-editor/components/editor-ui";

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
  return (
    <EditorDialog
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      title="图片 URL"
      size="sm"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
          <Button type="submit" form="canvas-image-url-form" disabled={!value.trim()}>添加</Button>
        </>
      }
    >
      <form
        id="canvas-image-url-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <EditorField label="图片地址">
          <Input value={value} autoFocus placeholder="https://example.com/image.png" onChange={(event) => onChange(event.target.value)} />
        </EditorField>
      </form>
    </EditorDialog>
  );
}
