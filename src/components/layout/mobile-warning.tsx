"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-media-query";

const STORAGE_KEY = "stage-link-mobile-warning-dismissed";

export function MobileWarning() {
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    if (!isMobile || typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) !== "1") {
      setDismissed(false);
    }
  }, [isMobile]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const show = isMobile && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-between gap-3 rounded-xl border border-gold/30 bg-surface-1/95 px-3 py-2.5 text-left shadow-lg backdrop-blur-sm md:hidden"
        >
          <p className="text-xs text-foreground/90 leading-snug">
            For the best experience, we recommend using a tablet or laptop.
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
