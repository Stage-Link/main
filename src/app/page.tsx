"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor, Radio } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-0 text-foreground flex items-center justify-center">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          className="max-w-2xl mx-auto text-center space-y-10"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          {/* Header */}
          <motion.div className="space-y-3" variants={fadeUp} transition={{ duration: 0.5 }}>
            <h1 className="text-5xl font-display font-semibold tracking-tight text-gold">
              Stage Link
            </h1>
            <p className="text-muted-foreground text-sm">
              Real-time stage monitoring system for theater crews
            </p>
            <motion.div variants={scaleIn} transition={{ duration: 0.3 }}>
              <Badge variant="stat-muted">v2.0</Badge>
            </motion.div>
          </motion.div>

          {/* Navigation Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            variants={stagger}
          >
            <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
              <Link href="/host" className="group block">
                <Card className="h-full border-white/10 hover:border-gold/30 hover:glow-gold transition-all duration-300">
                  <CardHeader className="items-center text-center space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center mb-1">
                      <Radio className="h-5 w-5 text-gold" strokeWidth={1.8} />
                    </div>
                    <CardTitle className="text-gold">Host Control</CardTitle>
                    <CardDescription>
                      Manage cameras and show settings
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: 0.4 }}>
              <Link href="/viewer" className="group block">
                <Card className="h-full border-white/10 hover:border-crimson/30 hover:glow-crimson transition-all duration-300">
                  <CardHeader className="items-center text-center space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-crimson/10 flex items-center justify-center mb-1">
                      <Monitor className="h-5 w-5 text-crimson" strokeWidth={1.8} />
                    </div>
                    <CardTitle className="text-crimson">View Feed</CardTitle>
                    <CardDescription>
                      Watch the stage feed in real-time
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </motion.div>
          </motion.div>

          {/* Footer */}
          <motion.footer
            className="text-muted-foreground text-xs"
            variants={fadeUp}
            transition={{ duration: 0.4 }}
          >
            Created by Christian Furr
          </motion.footer>
        </motion.div>
      </div>
    </div>
  );
}
