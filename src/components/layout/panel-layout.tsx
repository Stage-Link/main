"use client";

import { type ReactNode, useState, useCallback } from "react";
import {
  Panel,
  Group,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  PanelRight,
  PanelBottom,
  Keyboard,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  useKeyboardShortcuts,
  formatShortcut,
  type KeyboardShortcut,
} from "@/hooks/use-keyboard-shortcuts";

interface PanelLayoutProps {
  children: ReactNode;
  sidePanel?: ReactNode;
  bottomPanel?: ReactNode;
  topBarCenter?: ReactNode;
  topBarRight?: ReactNode;
  mobileTopBarCenter?: ReactNode;
  shortcuts?: KeyboardShortcut[];
  showName?: string;
}

function ResizeHandle({ orientation }: { orientation: "horizontal" | "vertical" }) {
  return (
    <Separator
      className={cn(
        "group relative flex items-center justify-center transition-colors",
        orientation === "horizontal"
          ? "w-1.5 data-[separator]:hover:w-2 data-[separator]:active:w-2 hover:bg-gold/10 active:bg-gold/20"
          : "h-1.5 data-[separator]:hover:h-2 data-[separator]:active:h-2 hover:bg-gold/10 active:bg-gold/20"
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted-foreground/20 group-hover:bg-gold/40 group-active:bg-gold/60 transition-colors",
          orientation === "horizontal" ? "h-8 w-0.5" : "w-8 h-0.5"
        )}
      />
    </Separator>
  );
}

export function PanelLayout({
  children,
  sidePanel,
  bottomPanel,
  topBarCenter,
  topBarRight,
  mobileTopBarCenter,
  shortcuts = [],
  showName,
}: PanelLayoutProps) {
  const [sidePanelVisible, setSidePanelVisible] = useState(true);
  const [bottomPanelVisible, setBottomPanelVisible] = useState(!!bottomPanel);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const mainLayout = useDefaultLayout({ id: "stagelink-main" });
  const verticalLayout = useDefaultLayout({ id: "stagelink-vertical" });

  const toggleSidePanel = useCallback(() => setSidePanelVisible((v) => !v), []);
  const toggleBottomPanel = useCallback(() => setBottomPanelVisible((v) => !v), []);

  const allShortcuts: KeyboardShortcut[] = [
    ...(sidePanel
      ? [
          {
            key: "b",
            action: toggleSidePanel,
            description: "Toggle side panel",
          },
        ]
      : []),
    ...(bottomPanel
      ? [
          {
            key: "j",
            action: toggleBottomPanel,
            description: "Toggle bottom panel",
          },
        ]
      : []),
    {
      key: "?",
      shift: true,
      action: () => setShowShortcuts((v) => !v),
      description: "Show keyboard shortcuts",
    },
    ...shortcuts,
  ];

  useKeyboardShortcuts(allShortcuts);

  return (
    <div className="flex h-[100dvh] flex-col bg-surface-0 text-foreground font-sans overflow-hidden">
      {/* Top App Bar */}
      <motion.header
        className="h-11 flex items-center justify-between px-3 md:px-4 bg-surface-1 border-b border-border shrink-0 z-20"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-display font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-gold animate-live-pulse" aria-hidden />
            Stage<span className="text-gold">Link</span>
          </Link>
          {showName && (
            <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[200px]">
              {showName}
            </span>
          )}
        </div>

        {mobileTopBarCenter != null && (
          <div className="flex md:hidden flex-1 justify-center items-center gap-2 min-w-0 px-2">
            {mobileTopBarCenter}
          </div>
        )}
        {topBarCenter && (
          <div className="hidden md:flex items-center gap-3 flex-1 justify-center">
            {topBarCenter}
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {bottomPanel && (
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                "hidden md:inline-flex",
                bottomPanelVisible && "text-gold"
              )}
              onClick={toggleBottomPanel}
              title="Toggle bottom panel (J)"
            >
              <PanelBottom className="h-3.5 w-3.5" />
            </Button>
          )}
          {sidePanel && (
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn(
                "hidden md:inline-flex",
                sidePanelVisible && "text-gold"
              )}
              onClick={toggleSidePanel}
              title="Toggle side panel (B)"
            >
              <PanelRight className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            className="hidden md:inline-flex"
            onClick={() => setShowShortcuts((v) => !v)}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
          {sidePanel && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open menu"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
          {topBarRight && (
            <div className="hidden md:flex items-center gap-2">
              {topBarRight}
            </div>
          )}
        </div>
      </motion.header>

      {/* Body — resizable panels */}
      <div className="flex-1 overflow-hidden">
        <Group
          orientation="horizontal"
          defaultLayout={mainLayout.defaultLayout}
          onLayoutChanged={mainLayout.onLayoutChanged}
        >
          {/* Main + optional bottom panel */}
          <Panel id="main" minSize="30%">
            {bottomPanel && bottomPanelVisible ? (
              <Group
                orientation="vertical"
                defaultLayout={verticalLayout.defaultLayout}
                onLayoutChanged={verticalLayout.onLayoutChanged}
              >
                <Panel id="content" minSize="20%">
                  <main className="h-full overflow-y-auto min-w-0">
                    {children}
                  </main>
                </Panel>
                <ResizeHandle orientation="vertical" />
                <Panel id="bottom" minSize="10%" maxSize="50%">
                  <div className="h-full bg-surface-1 border-t border-border overflow-hidden flex flex-col">
                    {bottomPanel}
                  </div>
                </Panel>
              </Group>
            ) : (
              <main className="h-full overflow-y-auto min-w-0">
                {children}
              </main>
            )}
          </Panel>

          {/* Side panel */}
          {sidePanel && sidePanelVisible && (
            <>
              <ResizeHandle orientation="horizontal" />
              <Panel
                id="side"
                minSize="15%"
                maxSize="40%"
              >
                <aside className="h-full bg-surface-1 border-l border-border flex flex-col overflow-hidden">
                  <div className="flex flex-col flex-1 min-h-0 py-2 gap-1 overflow-y-auto [scrollbar-gutter:stable]">
                    {sidePanel}
                  </div>
                </aside>
              </Panel>
            </>
          )}
        </Group>
      </div>

      {/* Mobile drawer */}
      {sidePanel && (
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetContent
            side="right"
            className="w-[280px] max-w-[85vw] sm:max-w-[280px] bg-surface-1 border-border p-0 gap-0 flex flex-col"
            showCloseButton
          >
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              {sidePanel}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-2 border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-semibold text-foreground">
                Keyboard Shortcuts
              </h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowShortcuts(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              {allShortcuts.map((s) => (
                <div
                  key={s.key + (s.shift ? "shift" : "") + (s.ctrl ? "ctrl" : "")}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">
                    {s.description}
                  </span>
                  <kbd className="bg-surface-3 border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground/80">
                    {formatShortcut(s)}
                  </kbd>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export function PanelSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-3 py-3 md:py-3 md:px-4", className)}>
      {title && (
        <h3 className="px-1 mb-2 text-xs font-semibold text-foreground uppercase tracking-wider">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
