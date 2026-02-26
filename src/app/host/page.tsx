"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useUser, useOrganization, useAuth, UserButton } from "@clerk/nextjs";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { useSubscription } from "@clerk/nextjs/experimental";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useLobby } from "@/hooks/use-lobby";
import { useIsMobilePortrait } from "@/hooks/use-media-query";
import { MobileWarning } from "@/components/layout/mobile-warning";
import type { OrgTier } from "@/lib/streams/types";
import {
  hasStreamAccess,
  hasFullAccessBySlug,
  getEffectiveViewerCap,
  getEffectiveOrgTier,
} from "@/lib/billing/plans";
import {
  BarChart3,
  ChevronUp,
  Eye,
  Settings,
  Monitor,
  FlipHorizontal2,
  Radio,
  Plus,
  StopCircle,
} from "lucide-react";

interface ChatMessage {
  text: string;
  sender: string;
  timestamp: string;
}

export default function HostPage() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const { has } = useAuth();
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription({
    for: "organization",
  });
  const maxViewers = getEffectiveViewerCap(subscription, organization?.slug);
  const orgTier: OrgTier = getEffectiveOrgTier(subscription, organization?.slug);
  const canUseSfu = has?.({ feature: "sfu_access" }) ?? false;
  const canUseHd = has?.({ feature: "hd_video" }) ?? false;
  const [streamMode, setStreamMode] = useState<StreamMode>("p2p");
  const [showName, setShowName] = useState("Untitled Show");
  const [viewerCount, setViewerCount] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const prevSfuStatusRef = useRef<string>("disconnected");

  const isMobilePortrait = useIsMobilePortrait();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState("");

  // Stream creation dialog — only camera name; show name is org-level
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCameraName, setNewCameraName] = useState("Camera 1");

  /** Show name is set at org level (Clerk org publicMetadata.showName or default) */
  const orgShowName =
    (organization?.publicMetadata?.showName as string | undefined)?.trim() ||
    "Untitled Show";

  // ── Lobby connection ───────────────────────────────────────────
  const lobby = useLobby({
    orgId: organization?.id ?? "",
    role: "host",
    tier: orgTier,
  });

  // P2P WebRTC hook (resolution capped by hd_video feature)
  const webrtc = useHostWebRTC({ canUseHd });

  // SFU hook — always called, but only connects when mode is "sfu"
  const sfu = useSfuHost(webrtc.stream);

  // Default username from Clerk user
  useEffect(() => {
    if (user && !username) {
      setUsername(user.firstName ?? user.username ?? "Host");
    }
  }, [user, username]);

  // Sync show name from org (show name is org-level)
  useEffect(() => {
    if (organization?.publicMetadata?.showName != null) {
      const name = (organization.publicMetadata.showName as string)?.trim();
      if (name) setShowName(name);
    }
  }, [organization?.publicMetadata?.showName]);

  // If org loses SFU access, switch to P2P
  useEffect(() => {
    if (!canUseSfu && streamMode === "sfu") {
      setStreamMode("p2p");
    }
  }, [canUseSfu, streamMode]);

  // The signaling room is scoped to the active stream
  const signalingRoom = lobby.activeStreamId
    ? `${organization?.id ?? ""}:${lobby.activeStreamId}`
    : "";

  // ── PartyKit signaling (per-stream) ────────────────────────────
  const party = useParty({
    room: signalingRoom,
    role: "host",
    orgId: organization?.id,

    onViewerJoined: useCallback(
      (viewerId: string) => {
        webrtc.addViewer(viewerId);
      },
      [webrtc.addViewer],
    ),

    onViewerLeft: useCallback(
      (viewerId: string) => {
        webrtc.removeViewer(viewerId);
      },
      [webrtc.removeViewer],
    ),

    onSignal: useCallback(
      (data: SignalMessage) => {
        webrtc.handleSignal(data);
      },
      [webrtc.handleSignal],
    ),

    onViewerCount: useCallback(
      (count: number) => {
        setViewerCount(count);
        // Report back to lobby for discovery
        if (lobby.activeStreamId) {
          lobby.reportViewerCount(lobby.activeStreamId, count);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [lobby.activeStreamId],
    ),

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
    if (!lobby.activeStreamId) return;

    if (streamMode === "sfu" && webrtc.stream) {
      sfu.connect();
    } else {
      sfu.disconnect();
    }

    if (party.connectionStatus === "connected") {
      party.announceHostMode(
        streamMode,
        streamMode === "sfu" ? sfu.sessionId : null,
        streamMode === "sfu" ? sfu.trackName : null,
        maxViewers,
        orgTier,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamMode, webrtc.stream, lobby.activeStreamId, maxViewers]);

  // When SFU info becomes available, re-announce + update lobby
  useEffect(() => {
    if (
      streamMode === "sfu" &&
      sfu.status === "connected" &&
      sfu.sessionId &&
      sfu.trackName &&
      party.connectionStatus === "connected"
    ) {
      party.announceHostMode("sfu", sfu.sessionId, sfu.trackName, maxViewers, orgTier);

      if (lobby.activeStreamId) {
        lobby.updateStream(lobby.activeStreamId, {
          mode: "sfu",
          sfuSessionId: sfu.sessionId,
          sfuTrackName: sfu.trackName,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamMode, sfu.status, sfu.sessionId, sfu.trackName, party.connectionStatus]);

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

  // ── Stream creation ────────────────────────────────────────────
  const handleCreateStream = useCallback(() => {
    const hostName = user?.firstName ?? user?.username ?? "Host";
    lobby.createStream(newCameraName || "Camera 1", orgShowName, hostName);
    setShowName(orgShowName);
    setShowCreateDialog(false);
    toast.success("Stream created!");
  }, [lobby, newCameraName, orgShowName, user]);

  const handleEndStream = useCallback(() => {
    if (lobby.activeStreamId) {
      sfu.disconnect();
      lobby.endStream(lobby.activeStreamId);
      setViewerCount(0);
      setMessages([]);
      toast.info("Stream ended");
    }
  }, [lobby, sfu]);

  // Show limit-reached toast
  useEffect(() => {
    if (lobby.limitReached) {
      toast.error(
        `Stream limit reached (${lobby.maxStreams} max). Upgrade your plan for more concurrent streams.`,
      );
    }
  }, [lobby.limitReached, lobby.maxStreams]);

  // Camera switch
  const handleCameraSwitch = useCallback(
    async (deviceId: string) => {
      await webrtc.switchCamera(deviceId);

      if (streamMode === "sfu" && sfu.status === "connected") {
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

  // Mode change + sync to lobby
  const handleModeChange = useCallback(
    (mode: StreamMode) => {
      setStreamMode(mode);
      if (lobby.activeStreamId) {
        lobby.updateStream(lobby.activeStreamId, { mode });
      }
      toast.info(
        mode === "sfu"
          ? "Switching to SFU mode (Cloudflare edge relay)"
          : "Switching to P2P mode (direct connections)",
      );
    },
    [lobby],
  );

  // Update show settings
  const handleUpdateSettings = useCallback(() => {
    if (party.connectionStatus === "connected") {
      const cameraIndex = webrtc.cameras.findIndex(
        (c) => c.deviceId === webrtc.selectedCamera,
      );
      party.updateShowSettings(showName, cameraIndex);
      if (lobby.activeStreamId) {
        lobby.updateStream(lobby.activeStreamId, { showName });
      }
      toast.success("Settings updated!");
    }
  }, [party.connectionStatus, party.updateShowSettings, showName, webrtc.cameras, webrtc.selectedCamera, lobby]);

  // Send chat message
  const handleSendMessage = useCallback(
    (text: string) => {
      if (party.connectionStatus !== "connected") return;
      const sender = username || "Host";
      party.sendChat(text, sender);
      setMessages((prev) => [
        ...prev,
        { text, sender, timestamp: new Date().toISOString() },
      ]);
    },
    [username, party.connectionStatus, party.sendChat],
  );

  const activeStats = streamMode === "sfu" ? sfu.stats : webrtc.stats;
  const isStreaming = !!lobby.activeStreamId;

  if (!organization) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center text-muted-foreground text-sm">
        Loading organization…
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
            A plan is required to host streams
          </h2>
          <p className="text-sm text-muted-foreground">
            Your organization needs an active subscription to host streams. Subscribe to Crew, Production, or Showtime to get started.
          </p>
        </div>
        <Button asChild className="bg-gold text-primary-foreground hover:bg-gold-bright">
          <Link href="/pricing">View plans</Link>
        </Button>
      </div>
    );
  }

  // ── Pre-stream state: show create stream dialog ────────────────
  if (!isStreaming) {
    return (
      <AppShell
        sidebar={
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
        }
        topBarCenter={
          <>
            <ConnectionStatus status={lobby.connectionStatus} />
            <Badge variant="stat-muted">
              <Radio className="h-3 w-3" />
              {lobby.streams.length}/{lobby.maxStreams} streams
            </Badge>
          </>
        }
        topBarRight={
          <>
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/host" afterCreateOrganizationUrl="/host" />
            <LiveClock />
            <UserButton />
          </>
        }
      >
        <div className="h-full flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-6 max-w-sm text-center">
            <div className="rounded-full bg-gold/10 p-6">
              <Radio className="h-10 w-10 text-gold" />
            </div>
            <div>
              <h2 className="text-lg font-display text-foreground font-semibold">
                Start a Stream
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create a new live stream for your organization.
                {lobby.streams.length > 0 && (
                  <span className="text-gold">
                    {" "}{lobby.streams.length} stream{lobby.streams.length !== 1 ? "s" : ""} already live.
                  </span>
                )}
              </p>
            </div>

            {lobby.streams.length > 0 && (
              <div className="w-full space-y-1.5">
                <span className="text-[11px] text-white/40 uppercase tracking-wider">Active Streams</span>
                {lobby.streams.map((s) => (
                  <div
                    key={s.streamId}
                    className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                      <span className="text-xs text-foreground truncate">{s.cameraName}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{s.showName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="stat-muted" className="text-[9px] px-1 py-0 h-4">
                        <Eye className="h-2.5 w-2.5" />
                        {s.viewerCount}
                      </Badge>
                      <Badge
                        variant={s.mode === "sfu" ? "mode-gold" : "stat-muted"}
                        className="text-[9px] px-1 py-0 h-4"
                      >
                        {s.mode.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={() => setShowCreateDialog(true)}
              disabled={lobby.streams.length >= lobby.maxStreams}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Stream
            </Button>
            {lobby.streams.length >= lobby.maxStreams && (
              <p className="text-[11px] text-red-400">
                Stream limit reached ({lobby.maxStreams} max).
                Upgrade your plan for more concurrent streams.
              </p>
            )}
          </div>
        </div>

        {/* Create stream dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Stream</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-[11px] text-white/50">
                Show: <span className="text-white/70 font-medium">{orgShowName}</span>
                {" "}(set in org settings)
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="cameraName" className="text-sm">
                  Camera Name
                </Label>
                <Input
                  id="cameraName"
                  value={newCameraName}
                  onChange={(e) => setNewCameraName(e.target.value)}
                  placeholder="Stage Left, Backstage, etc."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateStream();
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateStream}>
                <Radio className="h-4 w-4" />
                Go Live
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppShell>
    );
  }

  // ── Active streaming state (existing UI with lobby awareness) ──

  const showSettingsBlock = (
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
                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={mirrored ? "default" : "ghost"}
          size="sm"
          className="w-full"
          onClick={() => setMirrored((m) => !m)}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" />
          {mirrored ? "Mirrored" : "Flip Camera"}
        </Button>
        <Button onClick={handleUpdateSettings} size="sm" className="w-full">
          <Settings className="h-3.5 w-3.5" />
          Update Settings
        </Button>
      </div>
    </SidebarSection>
  );

  const sidebarFull = (
    <>
      <div className="flex-1 min-h-[10rem] min-h-0 flex flex-col overflow-hidden">
        <ChatPanel
          messages={messages}
          username={username}
          onUsernameChange={setUsername}
          onSendMessage={handleSendMessage}
        />
      </div>
      <div className="border-t border-white/[0.06]" />
      <SidebarSection title="Stream Mode">
        <StreamModeSelector
          mode={streamMode}
          onModeChange={handleModeChange}
          sfuStatus={streamMode === "sfu" ? sfu.status : undefined}
          canUseSfu={canUseSfu}
        />
      </SidebarSection>
      <div className="border-t border-white/[0.06]" />
      {showSettingsBlock}
      <div className="border-t border-white/[0.06]" />
      <SidebarSection title="Statistics">
        <StatsPanel webrtcStats={activeStats} />
      </SidebarSection>
      <div className="mt-auto border-t border-white/[0.06]">
        <SidebarSection>
          <div className="space-y-1">
            <Button
              variant="destructive"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={handleEndStream}
            >
              <StopCircle className="h-3.5 w-3.5" />
              End Stream
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs">
              <Link href="/viewer">
                <Monitor className="h-3.5 w-3.5" />
                Switch to Viewer
              </Link>
            </Button>
          </div>
        </SidebarSection>
      </div>
    </>
  );

  const sidebarPortrait = (
    <>
      <SidebarSection title="Stream Mode">
        <StreamModeSelector
          mode={streamMode}
          onModeChange={handleModeChange}
          sfuStatus={streamMode === "sfu" ? sfu.status : undefined}
          canUseSfu={canUseSfu}
        />
      </SidebarSection>
      <div className="border-t border-white/[0.06]" />
      {showSettingsBlock}
      <div className="mt-auto border-t border-white/[0.06]">
        <SidebarSection>
          <div className="space-y-1">
            <Button
              variant="destructive"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={handleEndStream}
            >
              <StopCircle className="h-3.5 w-3.5" />
              End Stream
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs">
              <Link href="/viewer">
                <Monitor className="h-3.5 w-3.5" />
                Switch to Viewer
              </Link>
            </Button>
          </div>
        </SidebarSection>
      </div>
    </>
  );

  const sidebar = isMobilePortrait ? sidebarPortrait : sidebarFull;

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
      <Badge variant="stat-muted">
        <Radio className="h-3 w-3" />
        {lobby.streams.length}/{lobby.maxStreams}
      </Badge>
    </>
  );

  const mobileTopBarCenter = (
    <>
      <ConnectionStatus status={party.connectionStatus} />
      <Badge variant={streamMode === "sfu" ? "mode-gold" : "stat-muted"}>
        {streamMode.toUpperCase()}
      </Badge>
    </>
  );

  const topBarRight = (
    <>
      <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/host" afterCreateOrganizationUrl="/host" />
      <LiveClock />
      <UserButton />
    </>
  );

  return (
    <AppShell
      sidebar={sidebar}
      topBarCenter={topBarCenter}
      topBarRight={topBarRight}
      mobileTopBarCenter={mobileTopBarCenter}
    >
      {isMobilePortrait ? (
        <div className="h-full flex flex-col p-2 overflow-y-auto">
          <MobileWarning />
          <div className="flex-1 min-h-0 flex flex-col gap-3 mt-2">
            <div className="flex-1 min-h-0">
              <CameraPreview
                stream={webrtc.stream}
                loading={webrtc.loading}
                mirrored={mirrored}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="w-full justify-start text-xs"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {showStats ? "Hide Stats" : "Show Stats"}
            </Button>
            {showStats && (
              <div className="rounded-xl border border-white/[0.06] bg-surface-2 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-xs font-semibold text-white/80">Statistics</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowStats(false)}
                    className="h-7 gap-1 text-xs text-white/60 hover:text-white"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Close
                  </Button>
                </div>
                <div className="px-3 py-3">
                  <StatsPanel webrtcStats={activeStats} />
                </div>
              </div>
            )}
            <div className="shrink-0 flex flex-col min-h-[10rem] max-h-[36vh] rounded-xl border border-white/[0.06] bg-surface-1 overflow-hidden">
              <ChatPanel
                messages={messages}
                username={username}
                onUsernameChange={setUsername}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col p-2 md:p-4">
          <div className="flex-1 min-h-0">
            <CameraPreview
              stream={webrtc.stream}
              loading={webrtc.loading}
              mirrored={mirrored}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
