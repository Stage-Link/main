"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import type {
  StreamInfo,
  OrgTier,
  LobbyServerMessage,
} from "@/lib/streams/types";

export interface UseLobbyOptions {
  orgId: string;
  role: "host" | "viewer";
  tier?: OrgTier;
}

export interface UseLobbyReturn {
  streams: StreamInfo[];
  maxStreams: number;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
  createStream: (cameraName: string, showName: string, hostName: string) => void;
  updateStream: (
    streamId: string,
    updates: Partial<Pick<StreamInfo, "mode" | "sfuSessionId" | "sfuTrackName" | "cameraName" | "showName">>,
  ) => void;
  endStream: (streamId: string) => void;
  reportViewerCount: (streamId: string, viewerCount: number) => void;
  /** Set after a successful create-stream response */
  activeStreamId: string | null;
  limitReached: boolean;
}

export function useLobby(options: UseLobbyOptions): UseLobbyReturn {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [maxStreams, setMaxStreams] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("disconnected");
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const hasRoom = options.orgId.length > 0;

  const ws = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTY_HOST!,
    party: "lobby",
    room: hasRoom ? options.orgId : "_pending",
    startClosed: !hasRoom,
    query: {
      role: options.role,
      ...(options.tier ? { tier: options.tier } : {}),
    },

    onOpen() {
      setConnectionStatus("connected");
    },

    onClose() {
      setConnectionStatus("reconnecting");
    },

    onError() {
      // PartySocket auto-reconnects
    },

    onMessage(event) {
      let data: LobbyServerMessage;
      try {
        data = JSON.parse(event.data) as LobbyServerMessage;
      } catch {
        return;
      }

      switch (data.type) {
        case "stream-list":
          setStreams(data.streams);
          setMaxStreams(data.maxStreams);
          setLimitReached(false);
          break;

        case "stream-created":
          setStreams((prev) => [...prev, data.stream]);
          setActiveStreamId(data.stream.streamId);
          setLimitReached(false);
          break;

        case "stream-updated":
          setStreams((prev) =>
            prev.map((s) =>
              s.streamId === data.stream.streamId ? data.stream : s,
            ),
          );
          break;

        case "stream-removed":
          setStreams((prev) =>
            prev.filter((s) => s.streamId !== data.streamId),
          );
          if (activeStreamId === data.streamId) {
            setActiveStreamId(null);
          }
          break;

        case "limit-reached":
          setMaxStreams(data.maxStreams);
          setLimitReached(true);
          break;

        case "stream-viewer-count":
          setStreams((prev) =>
            prev.map((s) =>
              s.streamId === data.streamId
                ? { ...s, viewerCount: data.viewerCount }
                : s,
            ),
          );
          break;
      }
    },
  });

  const wsRef = useRef(ws);
  wsRef.current = ws;

  const createStream = useCallback(
    (cameraName: string, showName: string, hostName: string) => {
      setLimitReached(false);
      ws.send(
        JSON.stringify({
          type: "create-stream",
          cameraName,
          showName,
          hostName,
          tier: options.tier,
        }),
      );
    },
    [ws, options.tier],
  );

  const updateStream = useCallback(
    (
      streamId: string,
      updates: Partial<Pick<StreamInfo, "mode" | "sfuSessionId" | "sfuTrackName" | "cameraName" | "showName">>,
    ) => {
      ws.send(
        JSON.stringify({
          type: "update-stream",
          streamId,
          ...updates,
        }),
      );
    },
    [ws],
  );

  const endStream = useCallback(
    (streamId: string) => {
      ws.send(JSON.stringify({ type: "end-stream", streamId }));
      if (activeStreamId === streamId) {
        setActiveStreamId(null);
      }
    },
    [ws, activeStreamId],
  );

  const reportViewerCount = useCallback(
    (streamId: string, viewerCount: number) => {
      ws.send(
        JSON.stringify({ type: "stream-viewer-count", streamId, viewerCount }),
      );
    },
    [ws],
  );

  useEffect(() => {
    return () => {
      setActiveStreamId(null);
    };
  }, []);

  return {
    streams,
    maxStreams,
    connectionStatus,
    createStream,
    updateStream,
    endStream,
    reportViewerCount,
    activeStreamId,
    limitReached,
  };
}
