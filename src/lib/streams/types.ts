// ─── Stream Info ─────────────────────────────────────────────────
export interface StreamInfo {
  streamId: string;
  hostConnectionId: string;
  hostName: string;
  /** Per-stream camera/feed label (e.g. "Stage Left", "Backstage Cam") */
  cameraName: string;
  /** Org-wide show name (e.g. "Friday Night Live") */
  showName: string;
  mode: "p2p" | "sfu";
  sfuSessionId: string | null;
  sfuTrackName: string | null;
  viewerCount: number;
  createdAt: number;
}

// ─── Grid Layouts ────────────────────────────────────────────────
export type GridLayout = "1x1" | "2x1" | "2x2" | "3x3";

export const GRID_CELL_COUNTS: Record<GridLayout, number> = {
  "1x1": 1,
  "2x1": 2,
  "2x2": 4,
  "3x3": 9,
};

// ─── Lobby State ─────────────────────────────────────────────────
export interface LobbyState {
  streams: StreamInfo[];
  maxStreams: number;
}

// ─── Tier Limits ─────────────────────────────────────────────────
export type OrgTier = "crew" | "production" | "showtime";

export const STREAM_LIMITS: Record<OrgTier, number> = {
  crew: 1,
  production: 3,
  showtime: 10,
};

/** Default tier when billing not wired up. Use "production" (3) or "showtime" (10) for more streams. */
export const DEFAULT_TIER: OrgTier = "production";

// ─── Lobby Messages (Client -> Server) ──────────────────────────
export interface CreateStreamMessage {
  type: "create-stream";
  cameraName: string;
  showName: string;
  hostName: string;
  tier?: OrgTier;
}

export interface UpdateStreamMessage {
  type: "update-stream";
  streamId: string;
  mode?: "p2p" | "sfu";
  sfuSessionId?: string | null;
  sfuTrackName?: string | null;
  cameraName?: string;
  showName?: string;
}

export interface EndStreamMessage {
  type: "end-stream";
  streamId: string;
}

export type LobbyClientMessage =
  | CreateStreamMessage
  | UpdateStreamMessage
  | EndStreamMessage;

// ─── Lobby Messages (Server -> Client) ──────────────────────────
export interface StreamCreatedMessage {
  type: "stream-created";
  stream: StreamInfo;
}

export interface StreamListMessage {
  type: "stream-list";
  streams: StreamInfo[];
  maxStreams: number;
}

export interface StreamUpdatedMessage {
  type: "stream-updated";
  stream: StreamInfo;
}

export interface StreamRemovedMessage {
  type: "stream-removed";
  streamId: string;
}

export interface LimitReachedMessage {
  type: "limit-reached";
  maxStreams: number;
  currentCount: number;
}

export interface StreamViewerCountMessage {
  type: "stream-viewer-count";
  streamId: string;
  viewerCount: number;
}

export type LobbyServerMessage =
  | StreamCreatedMessage
  | StreamListMessage
  | StreamUpdatedMessage
  | StreamRemovedMessage
  | LimitReachedMessage
  | StreamViewerCountMessage;
