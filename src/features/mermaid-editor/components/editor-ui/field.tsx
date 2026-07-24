import { cloneElement, isValidElement, useId, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Search } from "iconoir-react/regular";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function EditorField({ label, htmlFor, description, descriptionId: providedDescriptionId, error, errorId: providedErrorId, children, className, ...props }: HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  descriptionId?: string;
  error?: ReactNode;
  errorId?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const descriptionId = providedDescriptionId ?? `${generatedId}-description`;
  const errorId = providedErrorId ?? `${generatedId}-error`;
  const generatedDescribedBy = [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(" ");
  const control = isValidElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" }>(children)
    ? cloneElement(children, {
      "aria-describedby": [children.props["aria-describedby"], generatedDescribedBy].filter(Boolean).join(" ") || undefined,
      "aria-invalid": children.props["aria-invalid"] ?? (error ? true : undefined)
    })
    : children;
  return <Field
    className={className}
    data-invalid={error ? "true" : undefined}
    data-description-id={description ? descriptionId : undefined}
    data-error-id={error ? errorId : undefined}
    {...props}
  >
    <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
    {control}
    {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
    {error ? <FieldError id={errorId}>{error}</FieldError> : null}
  </Field>;
}

export function EditorFieldError({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <FieldError className={className} {...props} />;
}

export function EditorSearchField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <InputGroup>
    <InputGroupAddon><Search data-icon /></InputGroupAddon>
    <InputGroupInput type="search" className={className} {...props} />
  </InputGroup>;
}

export function EditorNumberField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="number" inputMode="decimal" className="type-interface-technical" {...props} />;
}
