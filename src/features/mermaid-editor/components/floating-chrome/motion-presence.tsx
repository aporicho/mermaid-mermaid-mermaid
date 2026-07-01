import { useEffect, useRef, useState, type ReactNode } from "react";

import { panelMotionOffset } from "@/features/mermaid-editor/lib/editor-motion";
import { gsap, useEditorMotion, useGSAP } from "@/features/mermaid-editor/lib/use-gsap-motion";

export function MotionPresence({
  present,
  variant,
  className,
  children
}: {
  present: boolean;
  variant: "left" | "right" | "bottom" | "top" | "workspace";
  className?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(present);
  const ref = useRef<HTMLDivElement | null>(null);
  const motion = useEditorMotion();
  const offset = panelMotionOffset(variant, variant === "workspace" ? motion.distance.viewport : motion.distance.panel);

  useEffect(() => {
    if (present) setMounted(true);
  }, [present]);

  useGSAP(
    () => {
      const element = ref.current;
      if (!element || !mounted) return;

      if (present) {
        gsap.fromTo(
          element,
          {
            autoAlpha: motion.reduced ? 1 : 0,
            x: offset.x,
            y: offset.y,
            scale: motion.reduced ? 1 : 0.985
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: variant === "workspace" ? motion.duration.base : motion.duration.slow,
            ease: motion.ease.standard,
            overwrite: "auto",
            onComplete: () => {
              if (variant === "workspace") {
                gsap.set(element, { clearProps: "transform" });
              }
            }
          }
        );
        return;
      }

      gsap.to(element, {
        autoAlpha: 0,
        x: offset.x,
        y: offset.y,
        scale: motion.reduced ? 1 : 0.985,
        duration: motion.duration.base,
        ease: motion.ease.exit,
        overwrite: "auto",
        onComplete: () => setMounted(false)
      });
    },
    {
      dependencies: [
        mounted,
        motion.duration.base,
        motion.duration.slow,
        motion.ease.exit,
        motion.ease.standard,
        motion.reduced,
        offset.x,
        offset.y,
        present,
        variant
      ],
      scope: ref
    }
  );

  if (!mounted) return null;

  return (
    <div ref={ref} className={className} style={{ opacity: present ? 1 : 0 }}>
      {children}
    </div>
  );
}
