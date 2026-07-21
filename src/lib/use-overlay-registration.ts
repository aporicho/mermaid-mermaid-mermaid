import { useEffect, useId } from "react";

import { setGlobalOverlayActivity } from "@/lib/overlay-layers";

export function useOverlayRegistration(kind: string, open: boolean) {
  const id = useId();
  const token = `${kind}:${id}`;

  useEffect(() => {
    setGlobalOverlayActivity(token, open);
    return () => setGlobalOverlayActivity(token, false);
  }, [open, token]);
}
