import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Search } from "iconoir-react/regular";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function EditorField({ label, htmlFor, description, error, children, className, ...props }: HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return <div className={cn("grid gap-2", className)} {...props}><Label htmlFor={htmlFor}>{label}</Label>{children}{description ? <div className="type-interface-metadata text-muted-foreground">{description}</div> : null}{error ? <EditorFieldError>{error}</EditorFieldError> : null}</div>;
}

export function EditorFieldError({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cn("type-interface-metadata text-destructive", className)} {...props} />;
}

export function EditorSearchField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <label className="relative block"><Search className="editor-ui-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input type="search" className={cn("pl-9", className)} {...props} /></label>;
}

export function EditorNumberField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="number" inputMode="decimal" className="type-interface-technical" {...props} />;
}
