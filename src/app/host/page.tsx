"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CameraPreview } from "@/components/video/camera-preview";
import { StatsPanel } from "@/components/video/stats-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { LiveClock } from "@/components/layout/live-clock";
import {
  StreamModeSelector,
  type StreamMode,
} from "@/components/controls/stream-mode-selector";
import { Badge } from "@/components/ui/badge";
import { AppShell, SidebarSection } from "@/components/layout/app-shell";
import { toast } from "sonner";
import { useHostWebRTC } from "@/hooks/use-webrtc";
import { useSfuHost } from "@/hooks/use-sfu";
import { useParty, type SignalMessage } from "@/hooks/use-party";
import { Eye, Settings, Monitor, FlipHorizontal2 } from "lucide-react";

interface ChatMessage {
  text: string;
  sender: string;
  timestamp: string;
}

export default function HostPage() {
  const { user } = useUser();
  const [streamMode, setStreamMode] = useState<StreamMode>("p2p");
  const [showName, setShowName] = useState("Untitled Show");
  const [viewerCount, setViewerCount] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const prevSfuStatusRef = useRef<string>("disconnected");

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState("");

  // P2P WebRTC hook — transport-agnostic (no Socket.IO)
  const webrtc = useHostWebRTC();

  // SFU hook — always called, but only connects when mode is "sfu"
  const sfu = useSfuHost(webrtc.stream);

  // Default username from Clerk user
  useEffect(() => {
    if (user && !username) {
      setUsername(user.firstName ?? user.username ?? "Host");
    }
  }, [user, username]);

  // ── PartyKit signaling ────────────────────────────────────────
  const party = useParty({
    room: "stage-link-main",
    role: "host",

    // When a viewer joins, create a P2P peer connection for them
    onViewerJoined: useCallback(
      (viewerId: string) => {
        webrtc.addViewer(viewerId);
      },
      [webrtc.addViewer],
    ),

    // When a viewer leaves, clean up their peer connection
    onViewerLeft: useCallback(
      (viewerId: string) => {
        webrtc.removeViewer(viewerId);
      },
      [webrtc.removeViewer],
    ),

    // Relay incoming WebRTC signals (answers, ICE candidates) to the WebRTC hook
    onSignal: useCallback(
      (data: SignalMessage) => {
        webrtc.handleSignal(data);
      },
      [webrtc.handleSignal],
    ),

    // Viewer count updates from the server
    onViewerCount: useCallback((count: number) => {
      setViewerCount(count);
    }, []),

    // Chat messages from viewers
    onChatMessage: useCallback(
      (msg: { text: string; sender: string; timestamp: string }) => {
        setMessages((prev) => [...prev, msg]);
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

  // ── Set hostId from PartyKit connectionId ─────────────────────
  useEffect(() => {
    if (party.connectionId) {
      webrtc.setHostId(party.connectionId);
    }
  }, [party.connectionId, webrtc.setHostId]);

  // ── SFU connect/disconnect + announce mode via PartyKit ───────
  useEffect(() => {
    if (streamMode === "sfu" && webrtc.stream) {
      sfu.connect();
    } else {
      sfu.disconnect();
    }

    // Announce mode change to viewers via PartyKit
    if (party.connectionStatus === "connected") {
      party.announceHostMode(
        streamMode,
        streamMode === "sfu" ? sfu.sessionId : null,
        streamMode === "sfu" ? sfu.trackName : null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamMode, webrtc.stream]);

  // When SFU session/track info becomes available, re-announce via PartyKit
  useEffect(() => {
    if (
      streamMode === "sfu" &&
      sfu.status === "connected" &&
      sfu.sessionId &&
      sfu.trackName &&
      party.connectionStatus === "connected"
    ) {
      party.announceHostMode("sfu", sfu.sessionId, sfu.trackName);
    }
  }, [streamMode, sfu.status, sfu.sessionId, sfu.trackName, party.connectionStatus, party.announceHostMode]);

  // Toast on SFU status changes
  useEffect(() => {
    const prev = prevSfuStatusRef.current;
    prevSfuStatusRef.current = sfu.status;

    if (prev === sfu.status) return;

    if (sfu.status === "connected") {
      toast.success("SFU connected — streaming via Cloudflare edge");
    } else if (sfu.status === "error") {
      toast.error("SFU connection failed");
    }
  }, [sfu.status]);

  // Handle camera switch — replaces track on P2P peers AND SFU if active
  const handleCameraSwitch = useCallback(
    async (deviceId: string) => {
      await webrtc.switchCamera(deviceId);

      // If SFU is connected, also replace the track there
      if (streamMode === "sfu" && sfu.status === "connected") {
        // Wait a tick for the new stream to be set in state
        setTimeout(async () => {
          const videoEl = document.querySelector("video");
          const newStream = videoEl?.srcObject as MediaStream | null;
          const newTrack = newStream?.getVideoTracks()[0];
          if (newTrack) {
            await sfu.replaceTrack(newTrack);
          }
        }, 100);
      }

      toast.success("Camera switched successfully");
    },
    [webrtc.switchCamera, streamMode, sfu],
  );

  // Handle mode change
  const handleModeChange = useCallback((mode: StreamMode) => {
    setStreamMode(mode);
    toast.info(
      mode === "sfu"
        ? "Switching to SFU mode (Cloudflare edge relay)"
        : "Switching to P2P mode (direct connections)",
    );
  }, []);

  // Update show settings via PartyKit
  const handleUpdateSettings = useCallback(() => {
    if (party.connectionStatus === "connected") {
      const cameraIndex = webrtc.cameras.findIndex(
        (c) => c.deviceId === webrtc.selectedCamera,
      );
      party.updateShowSettings(showName, cameraIndex);
      toast.success("Settings updated!");
    }
  }, [party.connectionStatus, party.updateShowSettings, showName, webrtc.cameras, webrtc.selectedCamera]);

  // Send chat message via PartyKit
  const handleSendMessage = useCallback(
    (text: string) => {
      if (party.connectionStatus !== "connected") return;

      const sender = username || "Host";
      party.sendChat(text, sender);

      // Add locally immediately (optimistic)
      setMessages((prev) => [
        ...prev,
        { text, sender, timestamp: new Date().toISOString() },
      ]);
    },
    [username, party.connectionStatus, party.sendChat],
  );

  // Pick stats from the active mode
  const activeStats = streamMode === "sfu" ? sfu.stats : webrtc.stats;

  // ── Sidebar ───────────────────────────────────────────────────
  const sidebar = (
    <>
      {/* Chat takes the top portion */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatPanel
          messages={messages}
          username={username}
          onUsernameChange={setUsername}
          onSendMessage={handleSendMessage}
        />
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* Stream Mode Section */}
      <SidebarSection title="Stream Mode">
        <StreamModeSelector
          mode={streamMode}
          onModeChange={handleModeChange}
          sfuStatus={streamMode === "sfu" ? sfu.status : undefined}
        />
      </SidebarSection>

      <div className="border-t border-white/[0.06]" />

      {/* Show Settings Section */}
      <SidebarSection title="Show Settings">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="showName" className="text-[11px] text-white/60">
              Show Name
            </Label>
            <Input
              id="showName"
              value={showName}
              onChange={(e) => setShowName(e.target.value)}
              placeholder="Enter show name"
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cameraSelect" className="text-[11px] text-white/60">
              Camera
            </Label>
            <Select
              value={webrtc.selectedCamera}
              onValueChange={handleCameraSwitch}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {webrtc.cameras.map((camera) => (
                  <SelectItem
                    key={camera.deviceId}
                    value={camera.deviceId}
                  >
                    {camera.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Flip Camera Toggle */}
          <Button
            variant={mirrored ? "default" : "ghost"}
            size="sm"
            className="w-full"
            onClick={() => setMirrored((m) => !m)}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            {mirrored ? "Mirrored" : "Flip Camera"}
          </Button>

          <Button
            onClick={handleUpdateSettings}
            size="sm"
            className="w-full"
          >
            <Settings className="h-3.5 w-3.5" />
            Update Settings
          </Button>
        </div>
      </SidebarSection>

      <div className="border-t border-white/[0.06]" />

      {/* Statistics Section */}
      <SidebarSection title="Statistics">
        <StatsPanel webrtcStats={activeStats} />
      </SidebarSection>

      {/* Bottom spacer + nav */}
      <div className="mt-auto border-t border-white/[0.06]">
        <SidebarSection>
          <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs">
            <Link href="/viewer">
              <Monitor className="h-3.5 w-3.5" />
              Switch to Viewer
            </Link>
          </Button>
        </SidebarSection>
      </div>
    </>
  );

  // ── Top Bar ───────────────────────────────────────────────────
  const topBarCenter = (
    <>
      <ConnectionStatus status={party.connectionStatus} />
      <Badge variant="stat-muted">
        <Eye className="h-3 w-3" />
        {viewerCount}
      </Badge>
      <Badge variant={streamMode === "sfu" ? "mode-gold" : "stat-muted"}>
        {streamMode.toUpperCase()}
      </Badge>
    </>
  );

  const topBarRight = (
    <>
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
        {/* Camera Preview */}
        <div className="flex-1 min-h-0">
          <CameraPreview
            stream={webrtc.stream}
            loading={webrtc.loading}
            mirrored={mirrored}
          />
        </div>

        {/* Stream Info Bar */}
        <div className="mt-3 flex items-center justify-between bg-surface-2 rounded-xl px-4 py-2.5 border border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-gold animate-live-pulse" />
            <span className="text-xs text-white/60">Live Stream Active</span>
          </div>
          <span className="text-xs text-white/40 font-display">
            {showName}
          </span>
        </div>
      </div>
    </AppShell>
  );
}
