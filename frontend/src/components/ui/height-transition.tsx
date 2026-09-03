"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function HeightTransition({ children }: { children: React.ReactNode }) {
  const [height, setHeight] = useState<number | "auto">("auto");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });
    
    observer.observe(contentRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <motion.div
      animate={{ height }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    >
      <div ref={contentRef} className="w-full">
        {children}
      </div>
    </motion.div>
  );
}
