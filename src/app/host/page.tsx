"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
import { CrewChatPanel } from "@/components/chat/crew-chat-panel";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { LiveClock } from "@/components/layout/live-clock";
import {
  StreamModeSelector,
  type StreamMode,
} from "@/components/controls/stream-mode-selector";
import { Badge } from "@/components/ui/badge";
import { AppShell, SidebarSection } from "@/components/layout/app-shell";
import { PanelLayout, PanelSection } from "@/components/layout/panel-layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useHostWebRTC } from "@/hooks/use-webrtc";
import { useSfuHost } from "@/hooks/use-sfu";
import { useParty, type SignalMessage } from "@/hooks/use-party";
import { useLobby } from "@/hooks/use-lobby";
import { useIsMobile, useIsMobileLandscape } from "@/hooks/use-media-query";
import { MobileWarning } from "@/components/layout/mobile-warning";
import { ErrorState } from "@/components/error-state";
import type { KeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";
import type { OrgTier } from "@/lib/streams/types";
import {
  hasStreamAccess,
  hasFullAccessBySlug,
  getEffectiveViewerCap,
  getEffectiveOrgTier,
} from "@/lib/billing/plans";
import {
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
  const canUseSfu =
    (has?.({ feature: "sfu_access" }) ?? false) ||
    hasFullAccessBySlug(organization?.slug);
  const canUseHd = has?.({ feature: "hd_video" }) ?? false;
  const [streamMode, setStreamMode] = useState<StreamMode>("p2p");
  const [showName, setShowName] = useState("Untitled Show");
  const [viewerCount, setViewerCount] = useState(0);
  const [mirrored, setMirrored] = useState(false);
  const prevSfuStatusRef = useRef<string>("disconnected");
  const streamStartTimeRef = useRef<number | null>(null);
  const peakViewerCountRef = useRef(0);

  const isMobile = useIsMobile();
  const isMobileLandscape = useIsMobileLandscape();

  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [streamMessages, setStreamMessages] = useState<ChatMessage[]>([]);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCameraName, setNewCameraName] = useState("Camera 1");

  const orgShowName =
    (organization?.publicMetadata?.showName as string | undefined)?.trim() ||
    "Untitled Show";

  const lobby = useLobby({
    orgId: organization?.id ?? "",
    role: "host",
    tier: orgTier,
  });

  const webrtc = useHostWebRTC({ canUseHd });
  const sfu = useSfuHost(webrtc.stream);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    (user?.username as string) ||
    user?.primaryEmailAddress?.emailAddress ||
    "Host";

  useEffect(() => {
    if (organization?.publicMetadata?.showName != null) {
      const name = (organization.publicMetadata.showName as string)?.trim();
      if (name) setShowName(name);
    }
  }, [organization?.publicMetadata?.showName]);

  useEffect(() => {
    if (!canUseSfu && streamMode === "sfu") {
      setStreamMode("p2p");
    }
  }, [canUseSfu, streamMode]);

  const signalingRoom = lobby.activeStreamId
    ? `${organization?.id ?? ""}:${lobby.activeStreamId}`
    : "";

  const globalRoom = organization?.id ? `${organization.id}:global` : "";

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
        peakViewerCountRef.current = Math.max(peakViewerCountRef.current, count);
        if (lobby.activeStreamId) {
          lobby.reportViewerCount(lobby.activeStreamId, count);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [lobby.activeStreamId],
    ),

    onChatMessage: useCallback(
      (msg: { text: string; sender: string; timestamp: string }) => {
        setStreamMessages((prev) => [...prev, msg]);
      },
      [],
    ),
  });

  useEffect(() => {
    if (party.connectionStatus === "connected") {
      webrtc.setSendSignal(party.sendSignal);
    }
  }, [party.connectionStatus, party.sendSignal, webrtc.setSendSignal]);

  useEffect(() => {
    if (party.connectionId) {
      webrtc.setHostId(party.connectionId);
    }
  }, [party.connectionId, webrtc.setHostId]);

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

  const handleCreateStream = useCallback(() => {
    const hostName = user?.firstName ?? user?.username ?? "Host";
    lobby.createStream(newCameraName || "Camera 1", orgShowName, hostName);
    setShowName(orgShowName);
    setShowCreateDialog(false);
    toast.success("Stream created!");
  }, [lobby, newCameraName, orgShowName, user]);

  const handleEndStream = useCallback(() => {
    if (lobby.activeStreamId) {
      const start = streamStartTimeRef.current;
      const peak = peakViewerCountRef.current;
      sfu.disconnect();
      lobby.endStream(lobby.activeStreamId);
      setViewerCount(0);
      setStreamMessages([]);
      streamStartTimeRef.current = null;
      peakViewerCountRef.current = 0;

      let summary = "Stream ended";
      if (start != null) {
        const durationMs = Date.now() - start;
        const sec = Math.floor(durationMs / 1000);
        const min = Math.floor(sec / 60);
        const hours = Math.floor(min / 60);
        const durationStr =
          hours > 0
            ? `${hours}h ${min % 60}m`
            : min > 0
              ? `${min}m`
              : `${sec}s`;
        summary += ` · ${durationStr}`;
      }
      if (peak > 0) {
        summary += ` · Peak ${peak} viewer${peak !== 1 ? "s" : ""}`;
      }
      toast.success(summary, { duration: 5000 });
    }
  }, [lobby, sfu]);

  useEffect(() => {
    if (lobby.limitReached) {
      toast.error(
        `Stream limit reached (${lobby.maxStreams} max). Upgrade your plan for more concurrent streams.`,
      );
    }
  }, [lobby.limitReached, lobby.maxStreams]);

  useEffect(() => {
    if (lobby.activeStreamId && streamStartTimeRef.current === null) {
      streamStartTimeRef.current = Date.now();
    }
    if (!lobby.activeStreamId) {
      streamStartTimeRef.current = null;
      peakViewerCountRef.current = 0;
    }
  }, [lobby.activeStreamId]);

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
      if (party.connectionStatus !== "connected") return;
      party.sendChat(text, displayName);
      setStreamMessages((prev) => [
        ...prev,
        { text, sender: displayName, timestamp: new Date().toISOString() },
      ]);
    },
    [displayName, party.connectionStatus, party.sendChat],
  );

  const activeStats = streamMode === "sfu" ? sfu.stats : webrtc.stats;
  const isStreaming = !!lobby.activeStreamId;

  // Cycle camera via next index
  const cycleCameraNext = useCallback(() => {
    if (webrtc.cameras.length < 2) return;
    const idx = webrtc.cameras.findIndex((c) => c.deviceId === webrtc.selectedCamera);
    const next = (idx + 1) % webrtc.cameras.length;
    handleCameraSwitch(webrtc.cameras[next].deviceId);
  }, [webrtc.cameras, webrtc.selectedCamera, handleCameraSwitch]);

  const hostShortcuts: KeyboardShortcut[] = useMemo(
    () =>
      isStreaming
        ? [
            {
              key: "e",
              action: handleEndStream,
              description: "End stream",
            },
            {
              key: "c",
              action: cycleCameraNext,
              description: "Cycle camera",
            },
            {
              key: "m",
              action: () => setMirrored((v) => !v),
              description: "Toggle mirror",
            },
          ]
        : [],
    [isStreaming, handleEndStream, cycleCameraNext],
  );

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
        <ErrorState
          title="A plan is required to host streams"
          description="Your organization needs an active subscription to host streams. Subscribe to Crew, Production, or Showtime to get started."
          showGoHome={false}
        />
        <Button asChild className="bg-gold text-primary-foreground hover:bg-gold-bright">
          <Link href="/pricing">View plans</Link>
        </Button>
      </div>
    );
  }

  // ── Pre-stream state (chat on right, no left panel) ──────────────
  if (!isStreaming) {
    const preStreamRightPanel = (
      <div className="flex flex-col h-full min-h-0">
        <CrewChatPanel
          displayName={displayName}
          globalMessages={globalMessages}
          onGlobalSend={handleSendGlobalMessage}
          globalConnected={globalParty.connectionStatus === "connected"}
        />
        {lobby.streams.length > 0 && (
          <>
            <div className="border-t border-border" />
            <PanelSection title="Active Streams">
              {lobby.streams.map((s) => (
                <div
                  key={s.streamId}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1.5 mb-1"
                >
                  <span className="text-xs text-foreground truncate">{s.cameraName}</span>
                  <Badge variant="stat-muted" className="text-[9px] px-1 py-0 h-4">
                    <Eye className="h-2.5 w-2.5" />
                    {s.viewerCount}
                  </Badge>
                </div>
              ))}
            </PanelSection>
          </>
        )}
        <div className="mt-auto border-t border-border">
          <PanelSection>
            <Button asChild variant="ghost" size="sm" className="w-full justify-start text-xs">
              <Link href="/viewer">
                <Monitor className="h-3.5 w-3.5" />
                Switch to Viewer
              </Link>
            </Button>
          </PanelSection>
        </div>
      </div>
    );

    return (
      <PanelLayout
        leftPanel={undefined}
        rightPanel={preStreamRightPanel}
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
            {/* Theater-themed empty state */}
            <div className="relative">
              <div className="rounded-full bg-gold/10 p-6">
                <Radio className="h-10 w-10 text-gold" />
              </div>
              <div className="absolute inset-0 rounded-full bg-gold/5 animate-ping" />
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
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Active Streams</span>
                {lobby.streams.map((s) => (
                  <div
                    key={s.streamId}
                    className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
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
              <p className="text-[11px] text-crimson">
                Stream limit reached ({lobby.maxStreams} max).
                Upgrade your plan for more concurrent streams.
              </p>
            )}
          </div>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Stream</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                Show: <span className="text-foreground/70 font-medium">{orgShowName}</span>
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
      </PanelLayout>
    );
  }

  // ── Active streaming — resizable panels layout ─────────────────

  const showSettingsBlock = (
    <PanelSection title="Show Settings">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="showName" className="text-[11px] text-muted-foreground">
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
          <Label htmlFor="cameraSelect" className="text-[11px] text-muted-foreground">
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
    </PanelSection>
  );

  const rightPanel = (
    <div className="flex flex-col h-full min-h-0">
      <CrewChatPanel
        displayName={displayName}
        globalMessages={globalMessages}
        onGlobalSend={handleSendGlobalMessage}
        streamMessages={isStreaming ? streamMessages : undefined}
        onStreamSend={isStreaming ? handleSendStreamMessage : undefined}
        streamName={lobby.streams.find((s) => s.streamId === lobby.activeStreamId)?.cameraName}
        globalConnected={globalParty.connectionStatus === "connected"}
        streamConnected={isStreaming && party.connectionStatus === "connected"}
      />
    </div>
  );

  const bottomPanel = (
    <div className="flex flex-col h-full min-h-0">
      <Tabs defaultValue="settings" orientation="horizontal" className="flex flex-col h-full min-h-0">
        <div className="px-3 py-1.5 border-b border-border shrink-0">
          <TabsList className="w-full h-7 min-h-7 rounded-lg p-0.5 inline-flex flex-row items-center">
            <TabsTrigger value="settings" className="flex-1 text-xs px-3 py-1.5 rounded-md h-6 data-[state=active]:shadow-none">
              Settings
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex-1 text-xs px-3 py-1.5 rounded-md h-6 data-[state=active]:shadow-none">
              Statistics
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <TabsContent value="settings" className="h-full mt-0 data-[state=inactive]:hidden">
            <div className="overflow-auto">
              <PanelSection title="Stream Mode">
                <StreamModeSelector
                  mode={streamMode}
                  onModeChange={handleModeChange}
                  sfuStatus={streamMode === "sfu" ? sfu.status : undefined}
                  canUseSfu={canUseSfu}
                />
              </PanelSection>
              <div className="border-t border-border" />
              {showSettingsBlock}
              <div className="border-t border-border" />
              <PanelSection>
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
              </PanelSection>
            </div>
          </TabsContent>
          <TabsContent value="stats" className="h-full mt-0 data-[state=inactive]:hidden">
            <div className="p-3 overflow-auto">
              <StatsPanel webrtcStats={activeStats} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );

  const topBarCenter = (
    <>
      <ConnectionStatus status={party.connectionStatus} />
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {viewerCount} watching
      </span>
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

  const mobileTopBarRight = (
    <>
      <UserButton />
    </>
  );

  if (isMobile) {
    return (
      <AppShell
        sidebar={
          <>
            <SidebarSection title="Stream Mode">
              <StreamModeSelector
                mode={streamMode}
                onModeChange={handleModeChange}
                sfuStatus={streamMode === "sfu" ? sfu.status : undefined}
                canUseSfu={canUseSfu}
              />
            </SidebarSection>
            <div className="border-t border-border" />
            {showSettingsBlock}
            <div className="border-t border-border" />
            <SidebarSection title="Statistics">
              <StatsPanel webrtcStats={activeStats} />
            </SidebarSection>
            <div className="mt-auto border-t border-border">
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
        }
        topBarCenter={topBarCenter}
        topBarRight={topBarRight}
        mobileTopBarRight={mobileTopBarRight}
        mobileTopBarCenter={mobileTopBarCenter}
      >
        {isMobileLandscape ? (
          <div className="h-full flex flex-row flex-1 min-h-0 overflow-hidden p-1.5">
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden rounded-xl bg-black/20">
              <CameraPreview
                stream={webrtc.stream}
                loading={webrtc.loading}
                mirrored={mirrored}
              />
            </div>
            <div className="w-px shrink-0 bg-border" aria-hidden />
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col border border-border rounded-xl bg-surface-1">
              <CrewChatPanel
                displayName={displayName}
                globalMessages={globalMessages}
                onGlobalSend={handleSendGlobalMessage}
                streamMessages={streamMessages}
                onStreamSend={handleSendStreamMessage}
                streamName={lobby.streams.find((s) => s.streamId === lobby.activeStreamId)?.cameraName}
                globalConnected={globalParty.connectionStatus === "connected"}
                streamConnected={party.connectionStatus === "connected"}
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-hidden p-1.5">
            <MobileWarning />
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="shrink-0 w-full aspect-video min-h-0 overflow-hidden rounded-t-xl bg-black/20">
                <CameraPreview
                  stream={webrtc.stream}
                  loading={webrtc.loading}
                  mirrored={mirrored}
                />
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col border border-border border-t-0 rounded-b-xl bg-surface-1">
                <CrewChatPanel
                  displayName={displayName}
                  globalMessages={globalMessages}
                  onGlobalSend={handleSendGlobalMessage}
                  streamMessages={streamMessages}
                  onStreamSend={handleSendStreamMessage}
                  streamName={lobby.streams.find((s) => s.streamId === lobby.activeStreamId)?.cameraName}
                  globalConnected={globalParty.connectionStatus === "connected"}
                  streamConnected={party.connectionStatus === "connected"}
                />
              </div>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <PanelLayout
      leftPanel={undefined}
      rightPanel={rightPanel}
      bottomPanel={bottomPanel}
      topBarCenter={topBarCenter}
      topBarRight={topBarRight}
      mobileTopBarCenter={mobileTopBarCenter}
      shortcuts={hostShortcuts}
      showName={showName}
    >
      <div className="h-full flex flex-col p-2 md:p-4">
        <div className="flex-1 min-h-0">
          <CameraPreview
            stream={webrtc.stream}
            loading={webrtc.loading}
            mirrored={mirrored}
          />
        </div>
      </div>
    </PanelLayout>
  );
}
