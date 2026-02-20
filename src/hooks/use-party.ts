"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import usePartySocket from "partysocket/react";

// ─── Types ──────────────────────────────────────────────────────
export interface RoomState {
  hostId: string | null;
  hostMode: "p2p" | "sfu" | null;
  sfuSessionId: string | null;
  sfuTrackName: string | null;
  showSettings: { showName: string; selectedCamera: number };
  theme: string;
}

export interface SignalMessage {
  type: "offer" | "answer" | "ice-candidate";
  fromId: string;
  targetId: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

export interface HostModeInfo {
  mode: "p2p" | "sfu";
  sfuSessionId: string | null;
  sfuTrackName: string | null;
  maxViewers?: number;
}

export interface UsePartyOptions {
  room: string;
  role: "host" | "viewer";
  /** PartyKit party name — omit for the default (signaling) party */
  party?: string;
  /** Optional org ID for server-side validation (e.g. room should match org) */
  orgId?: string;
  onSignal?: (data: SignalMessage) => void;
  onViewerJoined?: (viewerId: string) => void;
  onViewerLeft?: (viewerId: string) => void;
  onHostReady?: (info: HostModeInfo) => void;
  onHostLeft?: () => void;
  onChatMessage?: (msg: { text: string; sender: string; timestamp: string }) => void;
  onShowSettings?: (settings: { showName: string; selectedCamera: number }) => void;
  onThemeChange?: (theme: string) => void;
  onViewerCount?: (count: number) => void;
  onConnectionStatusChange?: (status: "connected" | "disconnected" | "reconnecting") => void;
  onRoomFull?: () => void;
}

export interface UsePartyReturn {
  connectionId: string | null;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
  sendSignal: (data: {
    type: "offer" | "answer" | "ice-candidate";
    targetId: string;
    sdp?: string;
    candidate?: RTCIceCandidateInit;
  }) => void;
  sendChat: (text: string, sender: string) => void;
  updateShowSettings: (showName: string, selectedCamera?: number) => void;
  changeTheme: (theme: string) => void;
  announceHostMode: (
    mode: "p2p" | "sfu",
    sfuSessionId?: string | null,
    sfuTrackName?: string | null,
    maxViewers?: number,
  ) => void;
}

// ─── Hook ───────────────────────────────────────────────────────
export function useParty(options: UsePartyOptions): UsePartyReturn {
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("disconnected");
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Store callbacks in refs so the socket handler always sees latest
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const wsRef = useRef<ReturnType<typeof usePartySocket> | null>(null);

  const hasRoom = options.room.length > 0;

  const ws = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTY_HOST!,
    party: options.party,
    room: hasRoom ? options.room : "_pending",
    startClosed: !hasRoom,
    query: {
      role: options.role,
      ...(options.orgId ? { orgId: options.orgId } : {}),
    },

    onOpen() {
      setConnectionStatus("connected");
      // ws.id is available on the socket instance after connection
      if (wsRef.current) {
        setConnectionId(wsRef.current.id);
      }
      callbacksRef.current.onConnectionStatusChange?.("connected");
    },

    onClose() {
      setConnectionStatus("reconnecting");
      callbacksRef.current.onConnectionStatusChange?.("reconnecting");
    },

    onError() {
      // PartySocket auto-reconnects; treat errors as transient
    },

    onMessage(event) {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      const cbs = callbacksRef.current;

      switch (data.type) {
        // Full room state sent to new viewers on connect
        case "room-state": {
          cbs.onShowSettings?.(
            data.showSettings as { showName: string; selectedCamera: number },
          );
          cbs.onThemeChange?.(data.theme as string);
          if (data.hostId && data.hostMode) {
            cbs.onHostReady?.({
              mode: data.hostMode as "p2p" | "sfu",
              sfuSessionId: (data.sfuSessionId as string) ?? null,
              sfuTrackName: (data.sfuTrackName as string) ?? null,
              maxViewers: typeof data.maxViewers === "number" ? data.maxViewers : undefined,
            });
          }
          break;
        }

        // WebRTC signaling
        case "offer":
        case "answer":
        case "ice-candidate":
          cbs.onSignal?.(data as unknown as SignalMessage);
          break;

        // Host/viewer lifecycle
        case "viewer-joined":
          cbs.onViewerJoined?.(data.viewerId as string);
          break;

        case "viewer-left":
          cbs.onViewerLeft?.(data.viewerId as string);
          break;

        case "host-ready":
          cbs.onHostReady?.({
            mode: (data.mode as "p2p" | "sfu") ?? "p2p",
            sfuSessionId: (data.sfuSessionId as string) ?? null,
            sfuTrackName: (data.sfuTrackName as string) ?? null,
            maxViewers: typeof data.maxViewers === "number" ? data.maxViewers : undefined,
          });
          break;

        case "room-full":
          cbs.onRoomFull?.();
          break;

        case "host-left":
          cbs.onHostLeft?.();
          break;

        // Chat
        case "chat-message":
          cbs.onChatMessage?.({
            text: data.message as string,
            sender: data.username as string,
            timestamp: new Date(data.timestamp as number).toISOString(),
          });
          break;

        // Show settings
        case "show-settings":
          cbs.onShowSettings?.(
            data as unknown as { showName: string; selectedCamera: number },
          );
          break;

        // Theme
        case "theme-change":
          cbs.onThemeChange?.(data.theme as string);
          break;

        // Viewer count
        case "viewer-count":
          cbs.onViewerCount?.(data.count as number);
          break;
      }
    },
  });

  // Keep ref in sync for use in callbacks
  wsRef.current = ws;

  // ── Send helpers ──────────────────────────────────────────────
  const sendSignal = useCallback(
    (data: {
      type: "offer" | "answer" | "ice-candidate";
      targetId: string;
      sdp?: string;
      candidate?: RTCIceCandidateInit;
    }) => {
      ws.send(JSON.stringify(data));
    },
    [ws],
  );

  const sendChat = useCallback(
    (text: string, sender: string) => {
      ws.send(
        JSON.stringify({
          type: "chat-message",
          username: sender,
          message: text,
          timestamp: Date.now(),
        }),
      );
    },
    [ws],
  );

  const updateShowSettings = useCallback(
    (showName: string, selectedCamera?: number) => {
      ws.send(
        JSON.stringify({
          type: "show-settings",
          showName,
          selectedCamera: selectedCamera ?? 0,
        }),
      );
    },
    [ws],
  );

  const changeTheme = useCallback(
    (theme: string) => {
      ws.send(JSON.stringify({ type: "theme-change", theme }));
    },
    [ws],
  );

  const announceHostMode = useCallback(
    (
      mode: "p2p" | "sfu",
      sfuSessionId?: string | null,
      sfuTrackName?: string | null,
      maxViewers?: number,
    ) => {
      ws.send(
        JSON.stringify({
          type: "host-ready",
          mode,
          sfuSessionId: sfuSessionId ?? null,
          sfuTrackName: sfuTrackName ?? null,
          ...(typeof maxViewers === "number" ? { maxViewers } : {}),
        }),
      );
    },
    [ws],
  );

  return {
    connectionId,
    connectionStatus,
    sendSignal,
    sendChat,
    updateShowSettings,
    changeTheme,
    announceHostMode,
  };
}
