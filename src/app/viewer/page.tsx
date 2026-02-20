"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video/video-player";
import { StatsPanel } from "@/components/video/stats-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { LiveClock } from "@/components/layout/live-clock";
import { Badge } from "@/components/ui/badge";
import { AppShell, SidebarSection } from "@/components/layout/app-shell";
import { useViewerWebRTC } from "@/hooks/use-webrtc";
import { useSfuViewer } from "@/hooks/use-sfu";
import {
  useParty,
  type SignalMessage,
  type HostModeInfo,
} from "@/hooks/use-party";
import { BarChart3, Info, Radio } from "lucide-react";

interface ChatMessage {
  text: string;
  sender: string;
  timestamp: string;
}

export default function ViewerPage() {
  // P2P WebRTC hook — transport-agnostic (no Socket.IO)
  const webrtc = useViewerWebRTC();

  // Host mode state (received from PartyKit)
  const [hostMode, setHostMode] = useState<HostModeInfo>({
    mode: "p2p",
    sfuSessionId: null,
    sfuTrackName: null,
  });

  // SFU viewer hook — always called (rules of hooks)
  const sfuViewer = useSfuViewer(hostMode.sfuSessionId, hostMode.sfuTrackName);

  const [showName, setShowName] = useState("Untitled Show");
  const [cameraName, setCameraName] = useState("Camera 1");
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showStats, setShowStats] = useState(false);

  // Track previous host mode to detect transitions
  const prevHostModeRef = useRef<"p2p" | "sfu">("p2p");

  // ── PartyKit signaling ────────────────────────────────────────
  const party = useParty({
    room: "stage-link-main",
    role: "viewer",

    // Relay incoming WebRTC signals (offers, ICE candidates) to the WebRTC hook
    onSignal: useCallback(
      (data: SignalMessage) => {
        webrtc.handleSignal(data);
      },
      [webrtc.handleSignal],
    ),

    // Host announces its mode (P2P or SFU)
    onHostReady: useCallback((info: HostModeInfo) => {
      console.log("Received host mode:", info);
      setHostMode(info);
    }, []),

    // Host disconnected
    onHostLeft: useCallback(() => {
      setHostMode({ mode: "p2p", sfuSessionId: null, sfuTrackName: null });
    }, []),

    // Chat messages from other users
    onChatMessage: useCallback(
      (msg: { text: string; sender: string; timestamp: string }) => {
        setMessages((prev) => [...prev, msg]);
      },
      [],
    ),

    // Show settings updated by host
    onShowSettings: useCallback(
      (settings: { showName: string; selectedCamera: number }) => {
        if (settings.showName) setShowName(settings.showName);
        setCameraName(`Camera ${(settings.selectedCamera ?? 0) + 1}`);
      },
      [],
    ),
  });

  // ── Wire PartyKit sendSignal to WebRTC hook ───────────────────
  useEffect(() => {
    if (party.connectionStatus === "connected") {
      webrtc.setSendSignal(party.sendSignal);
    }
  }, [party.connectionStatus, party.sendSignal, webrtc.setSendSignal]);

  // ── Set viewerId from PartyKit connectionId ───────────────────
  useEffect(() => {
    if (party.connectionId) {
      webrtc.setViewerId(party.connectionId);
    }
  }, [party.connectionId, webrtc.setViewerId]);

  // ── Auto-connect/disconnect SFU viewer when host mode changes ─
  useEffect(() => {
    const prev = prevHostModeRef.current;
    prevHostModeRef.current = hostMode.mode;

    if (
      hostMode.mode === "sfu" &&
      hostMode.sfuSessionId &&
      hostMode.sfuTrackName
    ) {
      // Disconnect previous SFU if reconnecting
      if (
        sfuViewer.status === "connected" ||
        sfuViewer.status === "connecting"
      ) {
        sfuViewer.disconnect();
      }
      // Small delay to allow disconnect cleanup before reconnecting
      const timer = setTimeout(
        () => {
          sfuViewer.connect();
        },
        prev === "sfu" ? 200 : 0,
      );
      return () => clearTimeout(timer);
    } else if (hostMode.mode === "p2p" && prev === "sfu") {
      // Switched back to P2P — disconnect SFU
      sfuViewer.disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostMode.mode, hostMode.sfuSessionId, hostMode.sfuTrackName]);

  // Send chat message via PartyKit
  const handleSendMessage = useCallback(
    (text: string) => {
      if (party.connectionStatus !== "connected") return;

      const sender = username || "Anonymous";
      party.sendChat(text, sender);

      // Add locally immediately (optimistic)
      setMessages((prev) => [
        ...prev,
        { text, sender, timestamp: new Date().toISOString() },
      ]);
    },
    [username, party.connectionStatus, party.sendChat],
  );

  // Derive active stream and stats based on host mode
  const isSfuMode = hostMode.mode === "sfu";
  const activeStream = isSfuMode ? sfuViewer.stream : webrtc.stream;
  const activeLatency = isSfuMode ? (sfuViewer.latency ?? webrtc.latency) : webrtc.latency;
  const activeStats = isSfuMode ? sfuViewer.stats : webrtc.stats;
  const activeLoading = isSfuMode
    ? sfuViewer.status === "connecting" || sfuViewer.status === "disconnected"
    : webrtc.loading;

  // Derive connection status
  const activeConnectionStatus = isSfuMode
    ? sfuViewer.status === "connected"
      ? "connected"
      : sfuViewer.status === "error"
        ? "error"
        : sfuViewer.status === "connecting"
          ? "connecting"
          : "disconnected"
    : webrtc.connectionStatus;

  // ── Sidebar (Chat + optional Stats) ───────────────────────────
  const sidebar = (
    <>
      {/* Chat takes most of sidebar space */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatPanel
          messages={messages}
          username={username}
          onUsernameChange={setUsername}
          onSendMessage={handleSendMessage}
        />
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* Stats Toggle */}
      <SidebarSection>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowStats(!showStats)}
          className="w-full justify-start text-xs"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {showStats ? "Hide Stats" : "Show Stats"}
        </Button>
      </SidebarSection>

      {/* Collapsible Stats */}
      {showStats && (
        <>
          <div className="border-t border-white/[0.06]" />
          <SidebarSection title="Statistics">
            <StatsPanel
              webrtcStats={activeStats}
              latency={activeLatency}
            />
          </SidebarSection>

          <div className="border-t border-white/[0.06]" />
          <SidebarSection title="Stream Info">
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-white/60">Show</span>
                <span className="text-white font-medium">{showName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Camera</span>
                <span className="text-white font-medium">{cameraName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Mode</span>
                <span className="text-gold font-medium">
                  {isSfuMode ? "SFU (Cloudflare)" : "P2P (Direct)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Status</span>
                <span className="text-gold font-medium">Live</span>
              </div>
            </div>
          </SidebarSection>
        </>
      )}

      {/* Bottom nav */}
      <div className="mt-auto border-t border-white/[0.06]">
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
  );

  // ── Top Bar ───────────────────────────────────────────────────
  const topBarCenter = (
    <>
      <span className="text-sm font-display text-gold truncate max-w-48">
        {showName}
      </span>
      <ConnectionStatus status={activeConnectionStatus} />
      <Badge variant={isSfuMode ? "mode-gold" : "stat-muted"}>
        {isSfuMode ? "SFU" : "P2P"}
      </Badge>
    </>
  );

  const topBarRight = (
    <>
      <span className="text-[10px] text-white/40">
        {username || "Guest"}
      </span>
      <LiveClock />
      <UserButton />
    </>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <AppShell
      sidebar={sidebar}
      topBarCenter={topBarCenter}
      topBarRight={topBarRight}
    >
      <div className="h-full flex flex-col p-4">
        {/* Video Player */}
        <div className="flex-1 min-h-0">
          <VideoPlayer
            stream={activeStream}
            loading={activeLoading}
            cameraName={cameraName}
          />
        </div>

        {/* Stream Info Bar */}
        <div className="mt-3 flex items-center justify-between bg-surface-2 rounded-xl px-4 py-2.5 border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-gold animate-live-pulse" />
            <span className="text-xs text-white/60">Live Stream Active</span>
          </div>
          <span className="text-xs text-white/40">
            Viewing as{" "}
            <span className="text-foreground font-medium">
              {username || "Guest"}
            </span>
          </span>
        </div>
      </div>
    </AppShell>
  );
}
