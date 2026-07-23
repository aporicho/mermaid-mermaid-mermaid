import { RefreshDouble } from "iconoir-react/regular";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<typeof RefreshDouble>) {
  return <RefreshDouble role="status" aria-label="加载中" className={cn("animate-spin", className)} {...props} />;
}

export { Spinner };
