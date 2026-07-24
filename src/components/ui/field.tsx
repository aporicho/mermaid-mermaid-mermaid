import { useMemo, type ComponentProps, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex flex-col gap-[var(--theme-panel-padding)] has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3", className)}
      {...props}
    />
  );
}

function FieldLegend({ className, variant = "legend", ...props }: ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn("mb-3 data-[variant=label]:type-interface-heading data-[variant=legend]:type-interface-heading", className)}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("group/field-group flex w-full flex-col gap-[var(--theme-panel-padding)] data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4", className)}
      {...props}
    />
  );
}

const fieldVariants = cva("group/field flex w-full gap-3 data-[invalid=true]:text-destructive", {
  variants: {
    orientation: {
      vertical: "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
      horizontal: "flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start",
      responsive: "flex-col [&>*]:w-full [&>.sr-only]:w-auto sm:flex-row sm:items-center sm:[&>*]:w-auto sm:[&>[data-slot=field-label]]:flex-auto sm:has-[>[data-slot=field-content]]:items-start"
    }
  },
  defaultVariants: { orientation: "vertical" }
});

function Field({ className, orientation = "vertical", ...props }: ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-content" className={cn("group/field-content flex flex-1 flex-col gap-1.5", className)} {...props} />;
}

function FieldLabel({ className, ...props }: ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label type-interface-control flex w-fit gap-2 group-data-[disabled=true]/field:opacity-[var(--ui-disabled-opacity)]",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-[var(--theme-radius-control-md)] has-[>[data-slot=field]]:border-[length:var(--ui-border-width)] has-[>[data-slot=field]]:p-4",
        "has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5",
        className
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-label" className={cn("type-interface-heading flex w-fit items-center gap-2 group-data-[disabled=true]/field:opacity-[var(--ui-disabled-opacity)]", className)} {...props} />;
}

function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("type-interface-metadata text-muted-foreground [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4", className)}
      {...props}
    />
  );
}

function FieldSeparator({ children, className, ...props }: ComponentProps<"div"> & { children?: ReactNode }) {
  return (
    <div data-slot="field-separator" data-content={Boolean(children)} className={cn("relative -my-2 h-5", className)} {...props}>
      <Separator className="absolute inset-x-0 top-1/2" />
      {children ? <span className="type-interface-metadata relative mx-auto block w-fit bg-background px-2 text-muted-foreground" data-slot="field-separator-content">{children}</span> : null}
    </div>
  );
}

function FieldError({ className, children, errors, ...props }: ComponentProps<"div"> & { errors?: Array<{ message?: string } | undefined> }) {
  const content = useMemo(() => {
    if (children) return children;
    if (!errors) return null;
    if (errors.length === 1 && errors[0]?.message) return errors[0].message;
    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {errors.map((error, index) => error?.message ? <li key={index}>{error.message}</li> : null)}
      </ul>
    );
  }, [children, errors]);

  if (!content) return null;
  return <div role="alert" data-slot="field-error" className={cn("type-interface-metadata text-destructive", className)} {...props}>{content}</div>;
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  fieldVariants
};
