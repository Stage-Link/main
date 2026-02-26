"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-0 text-foreground flex flex-col relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-gold/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/4 w-[400px] h-[300px] rounded-full bg-crimson/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-16">
        <motion.div
          className="max-w-xl w-full text-center space-y-8"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.div
            className="space-y-4"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl sm:text-6xl font-display-thin text-foreground">
              Stage<span className="text-gold">Link</span>
            </h1>
            <p className="text-6xl sm:text-7xl font-display font-semibold text-gold/90">
              404
            </p>
            <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
              This page isn&apos;t on stage. Head back to get in the wings.
            </p>
          </motion.div>
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <Button
              asChild
              size="lg"
              className="bg-gold text-primary-foreground hover:bg-gold-bright font-medium px-8 gap-2"
            >
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to home
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
