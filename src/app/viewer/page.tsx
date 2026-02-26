"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useOrganization, useUser, UserButton } from "@clerk/nextjs";
import { useSubscription } from "@clerk/nextjs/experimental";
import { useRouter } from "next/navigation";
import { OrganizationSwitcher } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { LiveClock } from "@/components/layout/live-clock";
import { Badge } from "@/components/ui/badge";
import { PanelLayout, PanelSection } from "@/components/layout/panel-layout";
import { AppShell, SidebarSection } from "@/components/layout/app-shell";
import { StreamGrid } from "@/components/video/stream-grid";
import { StreamSelector } from "@/components/video/stream-selector";
import { CrewChatPanel } from "@/components/chat/crew-chat-panel";
import { useLobby } from "@/hooks/use-lobby";
import { useParty, type SignalMessage } from "@/hooks/use-party";
import { useIsMobilePortrait } from "@/hooks/use-media-query";
import { MobileWarning } from "@/components/layout/mobile-warning";
import { hasStreamAccess, hasFullAccessBySlug } from "@/lib/billing/plans";
import { GRID_CELL_COUNTS, type GridLayout } from "@/lib/streams/types";
import type { KeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";
import { Radio, ArrowLeftRight } from "lucide-react";

interface ChatMessage {
  text: string;
  sender: string;
  timestamp: string;
}

export default function ViewerPage() {
  const { organization, isLoaded } = useOrganization();
  const { user } = useUser();
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription({
    for: "organization",
  });
  const router = useRouter();
  const isMobilePortrait = useIsMobilePortrait();

  const lobby = useLobby({
    orgId: organization?.id ?? "",
    role: "viewer",
  });

  const [selectedStreamIds, setSelectedStreamIds] = useState<string[]>([]);
  const [gridLayout] = useState<GridLayout>("1x1");
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [streamMessages, setStreamMessages] = useState<ChatMessage[]>([]);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    (user?.username as string) ||
    user?.primaryEmailAddress?.emailAddress ||
    "Viewer";

  const maxSelectable = GRID_CELL_COUNTS[gridLayout];

  const handleToggleStream = useCallback(
    (streamId: string) => {
      setSelectedStreamIds((prev) => {
        if (prev.includes(streamId)) {
          return prev.filter((id) => id !== streamId);
        }
        if (prev.length >= maxSelectable) {
          return prev;
        }
        return [...prev, streamId];
      });
    },
    [maxSelectable],
  );

  const activeStreamId = selectedStreamIds[0] ?? lobby.streams[0]?.streamId ?? "";
  const activeStreamInfo = lobby.streams.find((s) => s.streamId === activeStreamId);

  const globalRoom = organization?.id ? `${organization.id}:global` : "";
  const streamRoom = activeStreamId && organization?.id
    ? `${organization.id}:${activeStreamId}`
    : "";

  const globalParty = useParty({
    room: globalRoom,
    role: "viewer",
    orgId: organization?.id,

    onChatMessage: useCallback(
      (msg: { text: string; sender: string; timestamp: string }) => {
        setGlobalMessages((prev) => [...prev, msg]);
      },
      [],
    ),
  });

  const streamParty = useParty({
    room: streamRoom,
    role: "viewer",
    orgId: organization?.id,

    onSignal: useCallback((_data: SignalMessage) => {
      // Stream cells handle their own signaling — this is for chat only
    }, []),

    onChatMessage: useCallback(
      (msg: { text: string; sender: string; timestamp: string }) => {
        setStreamMessages((prev) => [...prev, msg]);
      },
      [],
    ),
  });

  const handleSendGlobalMessage = useCallback(
    (text: string) => {
      if (globalParty.connectionStatus !== "connected") return;
      globalParty.sendChat(text, displayName);
      setGlobalMessages((prev) => [
        ...prev,
        { text, sender: displayName, timestamp: new Date().toISOString() },
      ]);
    },
    [displayName, globalParty.connectionStatus, globalParty.sendChat],
  );

  const handleSendStreamMessage = useCallback(
    (text: string) => {
      if (streamParty.connectionStatus !== "connected") return;
      streamParty.sendChat(text, displayName);
      setStreamMessages((prev) => [
        ...prev,
        { text, sender: displayName, timestamp: new Date().toISOString() },
      ]);
    },
    [displayName, streamParty.connectionStatus, streamParty.sendChat],
  );

  useEffect(() => {
    setStreamMessages([]);
  }, [activeStreamId]);

  const viewerShortcuts: KeyboardShortcut[] = useMemo(() => {
    if (lobby.streams.length < 2) return [];
    return [
      {
        key: "n",
        action: () => {
          const currentIdx = lobby.streams.findIndex((s) => s.streamId === activeStreamId);
          const next = (currentIdx + 1) % lobby.streams.length;
          setSelectedStreamIds([lobby.streams[next].streamId]);
        },
        description: "Next stream",
      },
      {
        key: "p",
        action: () => {
          const currentIdx = lobby.streams.findIndex((s) => s.streamId === activeStreamId);
          const prev = currentIdx <= 0 ? lobby.streams.length - 1 : currentIdx - 1;
          setSelectedStreamIds([lobby.streams[prev].streamId]);
        },
        description: "Previous stream",
      },
    ];
  }, [lobby.streams, activeStreamId]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!organization) {
    router.replace("/org-select");
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center text-muted-foreground text-sm">
        Redirecting…
      </div>
    );
  }

  const isFreeAccess = hasFullAccessBySlug(organization?.slug);

  if (subscriptionLoading && !isFreeAccess) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center text-muted-foreground text-sm">
        Loading plan…
      </div>
    );
  }

  if (!hasStreamAccess(subscription, organization?.slug)) {
    return (
      <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center gap-6 px-6">
        <div className="max-w-md text-center space-y-2">
          <h2 className="text-lg font-display font-semibold text-foreground">
            A plan is required to view streams
          </h2>
          <p className="text-sm text-muted-foreground">
            Your organization needs an active subscription to view streams. Subscribe to Crew, Production, or Showtime to get started.
          </p>
        </div>
        <Button asChild className="bg-gold text-primary-foreground hover:bg-gold-bright">
          <Link href="/pricing">View plans</Link>
        </Button>
      </div>
    );
  }

  const leftPanel = (
    <div className="flex flex-col h-full min-h-0">
      <CrewChatPanel
        displayName={displayName}
        globalMessages={globalMessages}
        onGlobalSend={handleSendGlobalMessage}
        streamMessages={activeStreamId ? streamMessages : undefined}
        onStreamSend={activeStreamId ? handleSendStreamMessage : undefined}
        streamName={activeStreamInfo?.cameraName}
        globalConnected={globalParty.connectionStatus === "connected"}
        streamConnected={activeStreamId ? streamParty.connectionStatus === "connected" : false}
      />
    </div>
  );

  const rightPanel = (
    <>
      <PanelSection title="Live Streams">
        <StreamSelector
          streams={lobby.streams}
          selectedStreamIds={selectedStreamIds}
          onToggleStream={handleToggleStream}
          maxSelectable={maxSelectable}
        />
      </PanelSection>
      {lobby.streams.length > 1 && selectedStreamIds.length > 0 && (
        <>
          <div className="border-t border-border" />
          <PanelSection title="Quick Switch">
            <div className="space-y-1">
              {lobby.streams
                .filter((s) => !selectedStreamIds.includes(s.streamId))
                .map((stream) => (
                  <button
                    key={stream.streamId}
                    type="button"
                    onClick={() => setSelectedStreamIds([stream.streamId])}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                  >
                    <ArrowLeftRight className="h-3 w-3 shrink-0" />
                    <span className="truncate">{stream.cameraName}</span>
                  </button>
                ))}
            </div>
          </PanelSection>
        </>
      )}
      <div className="mt-auto border-t border-border">
        <PanelSection>
          <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs">
            <Link href="/">
              <Radio className="h-3.5 w-3.5" />
              Back to Home
            </Link>
          </Button>
        </PanelSection>
      </div>
    </>
  );

  const topBarCenter = (
    <>
      <ConnectionStatus status={lobby.connectionStatus} />
      <Badge variant="stat-muted">
        <Radio className="h-3 w-3" />
        {lobby.streams.length} live
      </Badge>
      {activeStreamInfo && (
        <Badge variant="stat-muted" className="hidden lg:inline-flex">
          {activeStreamInfo.cameraName}
        </Badge>
      )}
    </>
  );

  const topBarRight = (
    <>
      <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/viewer" afterCreateOrganizationUrl="/viewer" />
      <LiveClock />
      <UserButton />
    </>
  );

  if (isMobilePortrait) {
    return (
      <AppShell
        sidebar={
          <>
            <SidebarSection title="Live Streams">
              <StreamSelector
                streams={lobby.streams}
                selectedStreamIds={selectedStreamIds}
                onToggleStream={handleToggleStream}
                maxSelectable={maxSelectable}
              />
            </SidebarSection>
            <div className="mt-auto border-t border-border">
              <SidebarSection>
                <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs">
                  <Link href="/">
                    <Radio className="h-3.5 w-3.5" />
                    Back to Home
                  </Link>
                </Button>
              </SidebarSection>
            </div>
          </>
        }
        topBarCenter={topBarCenter}
        topBarRight={topBarRight}
        mobileTopBarCenter={topBarCenter}
      >
        <div className="h-full flex flex-col p-2 overflow-y-auto">
          <MobileWarning />
          <div className="flex-1 min-h-0 mt-2">
            <StreamGrid
              streams={lobby.streams}
              orgId={organization.id}
              selectedStreamIds={selectedStreamIds}
              onSelectedStreamIdsChange={setSelectedStreamIds}
            />
          </div>
          <div className="shrink-0 flex flex-col min-h-[10rem] max-h-[36vh] mt-3 rounded-xl border border-border bg-surface-1 overflow-hidden">
            <CrewChatPanel
              displayName={displayName}
              globalMessages={globalMessages}
              onGlobalSend={handleSendGlobalMessage}
              streamMessages={activeStreamId ? streamMessages : undefined}
              onStreamSend={activeStreamId ? handleSendStreamMessage : undefined}
              streamName={activeStreamInfo?.cameraName}
              globalConnected={globalParty.connectionStatus === "connected"}
              streamConnected={activeStreamId ? streamParty.connectionStatus === "connected" : false}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <PanelLayout
      leftPanel={leftPanel}
      rightPanel={rightPanel}
      topBarCenter={topBarCenter}
      topBarRight={topBarRight}
      mobileTopBarCenter={topBarCenter}
      shortcuts={viewerShortcuts}
      showName={activeStreamInfo?.showName}
    >
      <div className="h-full flex flex-col p-2 md:p-4">
        <div className="flex-1 min-h-0">
          <StreamGrid
            streams={lobby.streams}
            orgId={organization.id}
            selectedStreamIds={selectedStreamIds}
            onSelectedStreamIdsChange={setSelectedStreamIds}
          />
        </div>
      </div>
    </PanelLayout>
  );
}
