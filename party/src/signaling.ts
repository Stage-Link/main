import type * as Party from "partykit/server";

// ─── Plan Limits ────────────────────────────────────────────────

type OrgTier = "crew" | "production" | "showtime";

const TIER_VIEWER_CAP: Record<OrgTier, number> = {
  crew: 5,
  production: 50,
  showtime: 200,
};

function isValidTier(value: unknown): value is OrgTier {
  return value === "crew" || value === "production" || value === "showtime";
}

// ─── Message Types ──────────────────────────────────────────────

interface RoomState {
  hostId: string | null;
  hostMode: "p2p" | "sfu" | null;
  sfuSessionId: string | null;
  sfuTrackName: string | null;
  tier: OrgTier;
  maxViewers: number;
  streamId: string | null;
  showSettings: {
    showName: string;
    selectedCamera: number;
  };
  theme: string;
}

// ─── Server ─────────────────────────────────────────────────────
export default class SignalingServer implements Party.Server {
  state: RoomState = {
    hostId: null,
    hostMode: null,
    sfuSessionId: null,
    sfuTrackName: null,
    tier: "crew",
    maxViewers: TIER_VIEWER_CAP.crew,
    streamId: null,
    showSettings: { showName: "Untitled Show", selectedCamera: 0 },
    theme: "dark",
  };

  constructor(readonly room: Party.Room) {
    const parts = room.id.split(":");
    if (parts.length >= 2) {
      this.state.streamId = parts.slice(1).join(":");
      // Global org chat room — no host, allow many viewers
      if (this.state.streamId === "global") {
        this.state.maxViewers = 500;
      }
    }
  }

  // Tag connections as "host" or "viewer" based on query param
  getConnectionTags(
    connection: Party.Connection,
    ctx: Party.ConnectionContext,
  ) {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") ?? "viewer";
    return [role];
  }

  onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") ?? "viewer";

    if (role === "host") {
      this.state.hostId = connection.id;
      console.log("Host connected:", connection.id);

      // Notify all existing viewers that the host is here (include tier/maxViewers for consistency)
      this.room.broadcast(
        JSON.stringify({
          type: "host-ready",
          mode: this.state.hostMode,
          sfuSessionId: this.state.sfuSessionId,
          sfuTrackName: this.state.sfuTrackName,
          tier: this.state.tier,
          maxViewers: this.state.maxViewers,
        }),
        [connection.id],
      );
    } else {
      console.log("Viewer connected:", connection.id);

      const viewerCount = [...this.room.getConnections("viewer")].length;
      if (viewerCount > this.state.maxViewers) {
        connection.send(JSON.stringify({ type: "room-full" }));
        connection.close();
        return;
      }

      // Send full room state to the new viewer
      connection.send(
        JSON.stringify({
          type: "room-state",
          hostId: this.state.hostId,
          hostMode: this.state.hostMode,
          sfuSessionId: this.state.sfuSessionId,
          sfuTrackName: this.state.sfuTrackName,
          maxViewers: this.state.maxViewers,
          streamId: this.state.streamId,
          showSettings: this.state.showSettings,
          theme: this.state.theme,
        }),
      );

      // Notify host about the new viewer (for P2P connection initiation)
      if (this.state.hostId) {
        const host = this.room.getConnection(this.state.hostId);
        host?.send(
          JSON.stringify({
            type: "viewer-joined",
            viewerId: connection.id,
          }),
        );
      }
    }

    // Broadcast updated viewer count
    this.broadcastViewerCount();
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message);
    } catch {
      return; // Ignore malformed messages
    }

    switch (data.type) {
      // ── WebRTC signaling relay ──────────────────────────────
      case "offer":
      case "answer":
      case "ice-candidate": {
        const targetId = data.targetId as string;
        const target = this.room.getConnection(targetId);
        if (target) {
          target.send(
            JSON.stringify({ ...data, fromId: sender.id }),
          );
        }
        break;
      }

      case "host-ready": {
        this.state.hostMode = (data.mode as "p2p" | "sfu") ?? null;
        this.state.sfuSessionId = (data.sfuSessionId as string) ?? null;
        this.state.sfuTrackName = (data.sfuTrackName as string) ?? null;

        if (isValidTier(data.tier)) {
          this.state.tier = data.tier;
          this.state.maxViewers = TIER_VIEWER_CAP[data.tier];
        } else if (typeof data.maxViewers === "number" && data.maxViewers > 0) {
          const cap = TIER_VIEWER_CAP[this.state.tier];
          this.state.maxViewers = Math.min(data.maxViewers, cap);
        }

        console.log(
          "Host mode:",
          this.state.hostMode,
          this.state.sfuSessionId ? `SFU: ${this.state.sfuSessionId}` : "",
          `tier: ${this.state.tier}, maxViewers: ${this.state.maxViewers}`,
        );
        this.room.broadcast(message, [sender.id]);
        break;
      }

      // ── Show settings (from host) ──────────────────────────
      case "show-settings": {
        this.state.showSettings = {
          showName: (data.showName as string) ?? "Untitled Show",
          selectedCamera: (data.selectedCamera as number) ?? 0,
        };
        this.room.broadcast(message, [sender.id]);
        break;
      }

      // ── Theme change (from host) ──────────────────────────
      case "theme-change": {
        this.state.theme = (data.theme as string) ?? "dark";
        this.room.broadcast(message, [sender.id]);
        break;
      }

      // ── Chat message ──────────────────────────────────────
      case "chat-message": {
        // Broadcast to everyone except sender (sender adds locally)
        this.room.broadcast(message, [sender.id]);
        break;
      }
    }
  }

  onClose(connection: Party.Connection) {
    if (connection.id === this.state.hostId) {
      console.log("Host disconnected");
      this.state.hostId = null;
      this.state.hostMode = null;
      this.state.sfuSessionId = null;
      this.state.sfuTrackName = null;
      this.room.broadcast(JSON.stringify({ type: "host-left" }));
    } else {
      console.log("Viewer disconnected:", connection.id);
      // Notify host that this viewer left (for P2P cleanup)
      if (this.state.hostId) {
        const host = this.room.getConnection(this.state.hostId);
        host?.send(
          JSON.stringify({
            type: "viewer-left",
            viewerId: connection.id,
          }),
        );
      }
    }

    this.broadcastViewerCount();
  }

  onError(connection: Party.Connection, error: Error) {
    console.error("Connection error:", connection.id, error.message);
  }

  // ── Helpers ────────────────────────────────────────────────
  private broadcastViewerCount() {
    const viewerCount = [...this.room.getConnections("viewer")].length;
    this.room.broadcast(
      JSON.stringify({
        type: "viewer-count",
        count: viewerCount,
      }),
    );
  }
}
