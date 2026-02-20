import type * as Party from "partykit/server";

// ─── Types (mirrored from src/lib/streams/types.ts for server isolation) ─────

interface StreamInfo {
  streamId: string;
  hostConnectionId: string;
  hostName: string;
  cameraName: string;
  showName: string;
  mode: "p2p" | "sfu";
  sfuSessionId: string | null;
  sfuTrackName: string | null;
  viewerCount: number;
  createdAt: number;
}

type OrgTier = "crew" | "production" | "showtime";

const STREAM_LIMITS: Record<OrgTier, number> = {
  crew: 1,
  production: 3,
  showtime: 10,
};

const DEFAULT_TIER: OrgTier = "crew";

function isValidTier(value: unknown): value is OrgTier {
  return value === "crew" || value === "production" || value === "showtime";
}

// ─── Lobby Server ────────────────────────────────────────────────

export default class LobbyServer implements Party.Server {
  streams: Map<string, StreamInfo> = new Map();
  hostToStream: Map<string, string> = new Map();
  orgTier: OrgTier = DEFAULT_TIER;
  maxStreams: number = STREAM_LIMITS[DEFAULT_TIER];

  constructor(readonly room: Party.Room) {}

  getConnectionTags(
    _connection: Party.Connection,
    ctx: Party.ConnectionContext,
  ) {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") ?? "viewer";
    return [role];
  }

  onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") ?? "viewer";
    const rawTier = url.searchParams.get("tier");

    if (role === "host" && isValidTier(rawTier)) {
      this.orgTier = rawTier;
      this.maxStreams = STREAM_LIMITS[rawTier];
    }

    connection.send(
      JSON.stringify({
        type: "stream-list",
        streams: Array.from(this.streams.values()),
        maxStreams: this.maxStreams,
      }),
    );

    console.log(`Lobby: ${role} connected (${connection.id}), tier=${this.orgTier}, ${this.streams.size} active streams`);
  }

  onMessage(message: string, sender: Party.Connection) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    switch (data.type) {
      case "create-stream": {
        if (this.streams.size >= this.maxStreams) {
          sender.send(
            JSON.stringify({
              type: "limit-reached",
              maxStreams: this.maxStreams,
              currentCount: this.streams.size,
            }),
          );
          return;
        }

        if (this.hostToStream.has(sender.id)) {
          sender.send(
            JSON.stringify({
              type: "limit-reached",
              maxStreams: this.maxStreams,
              currentCount: this.streams.size,
            }),
          );
          return;
        }

        const streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const stream: StreamInfo = {
          streamId,
          hostConnectionId: sender.id,
          hostName: (data.hostName as string) || "Host",
          cameraName: (data.cameraName as string) || "Camera 1",
          showName: (data.showName as string) || "Untitled Show",
          mode: "p2p",
          sfuSessionId: null,
          sfuTrackName: null,
          viewerCount: 0,
          createdAt: Date.now(),
        };

        if (isValidTier(data.tier)) {
          this.orgTier = data.tier;
          this.maxStreams = STREAM_LIMITS[data.tier];
        }

        this.streams.set(streamId, stream);
        this.hostToStream.set(sender.id, streamId);

        sender.send(
          JSON.stringify({
            type: "stream-created",
            stream,
          }),
        );

        this.broadcastStreamList([sender.id]);
        console.log(`Lobby: stream created "${stream.showName}" (${streamId}) by ${sender.id}`);
        break;
      }

      case "update-stream": {
        const streamId = data.streamId as string;
        const stream = this.streams.get(streamId);
        if (!stream || stream.hostConnectionId !== sender.id) return;

        if (data.mode !== undefined) stream.mode = data.mode as "p2p" | "sfu";
        if (data.sfuSessionId !== undefined) stream.sfuSessionId = data.sfuSessionId as string | null;
        if (data.sfuTrackName !== undefined) stream.sfuTrackName = data.sfuTrackName as string | null;
        if (data.cameraName !== undefined) stream.cameraName = data.cameraName as string;
        if (data.showName !== undefined) stream.showName = data.showName as string;

        this.streams.set(streamId, stream);

        this.room.broadcast(
          JSON.stringify({ type: "stream-updated", stream }),
        );
        break;
      }

      case "end-stream": {
        const streamId = data.streamId as string;
        const stream = this.streams.get(streamId);
        if (!stream || stream.hostConnectionId !== sender.id) return;

        this.streams.delete(streamId);
        this.hostToStream.delete(sender.id);

        this.room.broadcast(
          JSON.stringify({ type: "stream-removed", streamId }),
        );
        console.log(`Lobby: stream ended "${stream.showName}" (${streamId})`);
        break;
      }

      case "stream-viewer-count": {
        const streamId = data.streamId as string;
        const viewerCount = data.viewerCount as number;
        const stream = this.streams.get(streamId);
        if (!stream) return;

        stream.viewerCount = viewerCount;
        this.streams.set(streamId, stream);

        this.room.broadcast(
          JSON.stringify({ type: "stream-viewer-count", streamId, viewerCount }),
        );
        break;
      }
    }
  }

  onClose(connection: Party.Connection) {
    const streamId = this.hostToStream.get(connection.id);
    if (streamId) {
      const stream = this.streams.get(streamId);
      this.streams.delete(streamId);
      this.hostToStream.delete(connection.id);

      this.room.broadcast(
        JSON.stringify({ type: "stream-removed", streamId }),
      );
      console.log(`Lobby: host disconnected, stream removed "${stream?.showName}" (${streamId})`);
    }
  }

  onError(connection: Party.Connection, error: Error) {
    console.error("Lobby connection error:", connection.id, error.message);
  }

  private broadcastStreamList(exclude: string[] = []) {
    this.room.broadcast(
      JSON.stringify({
        type: "stream-list",
        streams: Array.from(this.streams.values()),
        maxStreams: this.maxStreams,
      }),
      exclude,
    );
  }
}
