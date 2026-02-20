"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getIceConfig } from "@/lib/webrtc/ice-config";
import { setH264Preference } from "@/lib/webrtc/sdp-utils";
import {
  getWebRTCStats,
  resetStatsTracking,
  type WebRTCStats,
} from "@/lib/webrtc/stats";

// ─── Base media constraints ────────────────────────────────────────
const BASE_VIDEO_OPTIONS = {
  frameRate: { ideal: 30, max: 30 } as const,
  latency: { ideal: 0, max: 0.1 },
};

function getVideoConstraints(canUseHd: boolean): MediaTrackConstraints {
  return {
    ...BASE_VIDEO_OPTIONS,
    width: canUseHd ? { ideal: 1920, max: 1920 } : { ideal: 1280, max: 1280 },
    height: canUseHd ? { ideal: 1080, max: 1080 } : { ideal: 720, max: 720 },
  };
}

// ─── Signaling message types ────────────────────────────────────────
export interface SignalData {
  type: "offer" | "answer" | "ice-candidate";
  fromId: string;
  targetId?: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

// ─── Camera device type ──────────────────────────────────────────
export interface CameraDevice {
  deviceId: string;
  label: string;
}

// ─── Send signal function type ──────────────────────────────────
export type SendSignalFn = (data: {
  type: "offer" | "answer" | "ice-candidate";
  targetId: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}) => void;

// ═══════════════════════════════════════════════════════════════════
// HOST HOOK
// ═══════════════════════════════════════════════════════════════════
export interface UseHostWebRTCReturn {
  stream: MediaStream | null;
  cameras: CameraDevice[];
  selectedCamera: string;
  viewerCount: number;
  stats: WebRTCStats | null;
  loading: boolean;
  /** Call this with the sendSignal function from useParty */
  setSendSignal: (fn: SendSignalFn) => void;
  /** Feed incoming signal messages from PartyKit here */
  handleSignal: (msg: SignalData) => void;
  /** PartyKit calls this when a viewer joins (for P2P) */
  addViewer: (viewerId: string) => void;
  /** PartyKit calls this when a viewer leaves */
  removeViewer: (viewerId: string) => void;
  switchCamera: (deviceId: string) => Promise<void>;
  /** The host's connection ID (set externally from PartyKit) */
  hostId: string;
  setHostId: (id: string) => void;
}

export interface UseHostWebRTCOptions {
  /** If true, use 1080p; otherwise 720p (plan-gated via hd_video feature) */
  canUseHd?: boolean;
}

export function useHostWebRTC(options: UseHostWebRTCOptions = {}): UseHostWebRTCReturn {
  const { canUseHd = false } = options;
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [stats, setStats] = useState<WebRTCStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostId, setHostId] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const sendSignalRef = useRef<SendSignalFn | null>(null);
  const hostIdRef = useRef("");
  const iceConfigRef = useRef<RTCConfiguration | null>(null);
  const mountedRef = useRef(true);

  // Keep refs in sync
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    hostIdRef.current = hostId;
  }, [hostId]);

  // Set the send function (called by page when PartyKit is ready)
  const setSendSignal = useCallback((fn: SendSignalFn) => {
    sendSignalRef.current = fn;
  }, []);

  // Initialize camera with plan-gated resolution (720p vs 1080p)
  const initCamera = useCallback(
    async (deviceId?: string) => {
      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          console.warn(
            "getUserMedia not available (requires HTTPS or localhost on iOS)"
          );
          setLoading(false);
          return null;
        }

        const constraints: MediaStreamConstraints = {
          video: {
            ...getVideoConstraints(canUseHd),
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          },
          audio: false,
        };

      const mediaStream =
        await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setLoading(false);

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setCameras(videoDevices);

      if (!deviceId && videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }

      return mediaStream;
    } catch (error) {
      console.error("Error accessing camera:", error);
      setLoading(false);
      return null;
    }
  },
    [canUseHd],
  );

  // Create peer connection for a viewer (P2P mode)
  const createPeerConnection = useCallback(async (viewerId: string) => {
    if (!iceConfigRef.current) {
      iceConfigRef.current = await getIceConfig();
    }

    const pc = new RTCPeerConnection(iceConfigRef.current);
    peersRef.current.set(viewerId, pc);

    // Add current stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current!);
      });
    }

    // Create data channel for latency measurement (Task 1.6)
    const dataChannel = pc.createDataChannel("latency", {
      ordered: false,
      maxRetransmits: 0,
    });
    dataChannelsRef.current.set(viewerId, dataChannel);

    dataChannel.onopen = () => {
      console.log("Host data channel open for viewer:", viewerId);
    };

    dataChannel.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "ping" && dataChannel.readyState === "open") {
          dataChannel.send(JSON.stringify({ type: "pong", id: data.id }));
        }
      } catch {
        // Ignore malformed messages
      }
    };

    // ICE candidate handling — send via PartyKit
    pc.onicecandidate = (e) => {
      if (e.candidate && sendSignalRef.current) {
        console.log("Host ICE candidate:", e.candidate.type, e.candidate.protocol, e.candidate.address);
        sendSignalRef.current({
          type: "ice-candidate",
          targetId: viewerId,
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("Host ICE state for viewer", viewerId, ":", pc.iceConnectionState);
      if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "failed"
      ) {
        cleanupPeer(viewerId);
      }
    };

    // Set H.264 preference (Task 1.9)
    setH264Preference(pc);

    // Create offer and send via PartyKit
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (sendSignalRef.current) {
      sendSignalRef.current({
        type: "offer",
        targetId: viewerId,
        sdp: offer.sdp!,
      });
    }

    updateViewerCount();
  }, []);

  const cleanupPeer = useCallback((viewerId: string) => {
    const pc = peersRef.current.get(viewerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(viewerId);
    }
    dataChannelsRef.current.delete(viewerId);
    updateViewerCount();
  }, []);

  const updateViewerCount = useCallback(() => {
    if (mountedRef.current) {
      setViewerCount(peersRef.current.size);
    }
  }, []);

  // Handle incoming signal from PartyKit
  const handleSignal = useCallback((msg: SignalData) => {
    const pc = peersRef.current.get(msg.fromId);
    if (!pc) return;

    if (msg.type === "answer" && msg.sdp) {
      pc.setRemoteDescription({ type: "answer", sdp: msg.sdp }).catch((e) =>
        console.error("Error setting remote description:", e),
      );
    } else if (msg.type === "ice-candidate" && msg.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch((e) =>
        console.error("Error adding ICE candidate:", e),
      );
    }
  }, []);

  // PartyKit callback: new viewer joined
  const addViewer = useCallback(
    (viewerId: string) => {
      console.log("Viewer wants connection:", viewerId);
      createPeerConnection(viewerId);
    },
    [createPeerConnection],
  );

  // PartyKit callback: viewer left
  const removeViewer = useCallback(
    (viewerId: string) => {
      cleanupPeer(viewerId);
    },
    [cleanupPeer],
  );

  // Switch camera
  const switchCamera = useCallback(
    async (deviceId: string) => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const newStream = await initCamera(deviceId);
      if (!newStream) return;

      setSelectedCamera(deviceId);

      // Replace tracks on all existing peer connections
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        for (const [, pc] of peersRef.current) {
          const sender = pc
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }
    },
    [initCamera],
  );

  // Initialize camera + ICE config on mount
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      iceConfigRef.current = await getIceConfig();
      await initCamera();
    }

    init();

    // Stats polling (Task 1.8)
    const statsInterval = setInterval(async () => {
      for (const [, pc] of peersRef.current) {
        if (pc.connectionState === "connected") {
          const s = await getWebRTCStats(pc);
          if (mountedRef.current) setStats(s);
          break;
        }
      }
    }, 2000);

    return () => {
      mountedRef.current = false;
      clearInterval(statsInterval);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      for (const [, pc] of peersRef.current) {
        pc.close();
      }
      peersRef.current.clear();
      dataChannelsRef.current.clear();
    };
  }, [initCamera]);

  return {
    stream,
    cameras,
    selectedCamera,
    viewerCount,
    stats,
    loading,
    setSendSignal,
    handleSignal,
    addViewer,
    removeViewer,
    switchCamera,
    hostId,
    setHostId,
  };
}

// ═══════════════════════════════════════════════════════════════════
// VIEWER HOOK
// ═══════════════════════════════════════════════════════════════════
export interface UseViewerWebRTCReturn {
  stream: MediaStream | null;
  connectionStatus: "connected" | "disconnected" | "error" | "connecting";
  loading: boolean;
  latency: number | null;
  stats: WebRTCStats | null;
  /** Call this with the sendSignal function from useParty */
  setSendSignal: (fn: SendSignalFn) => void;
  /** Feed incoming signal messages from PartyKit here */
  handleSignal: (msg: SignalData) => void;
  /** Set the viewer's connection ID (from PartyKit) */
  viewerId: string;
  setViewerId: (id: string) => void;
}

export function useViewerWebRTC(): UseViewerWebRTCReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "error" | "connecting"
  >("connecting");
  const [loading, setLoading] = useState(true);
  const [latency, setLatency] = useState<number | null>(null);
  const [stats, setStats] = useState<WebRTCStats | null>(null);
  const [viewerId, setViewerId] = useState("");

  const sendSignalRef = useRef<SendSignalFn | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const viewerIdRef = useRef("");
  const pendingPingsRef = useRef<Map<string, number>>(new Map());
  const mountedRef = useRef(true);
  const iceConfigRef = useRef<RTCConfiguration | null>(null);

  useEffect(() => {
    viewerIdRef.current = viewerId;
  }, [viewerId]);

  const setSendSignal = useCallback((fn: SendSignalFn) => {
    sendSignalRef.current = fn;
  }, []);

  // Handle incoming signal from PartyKit
  const handleSignal = useCallback(async (msg: SignalData) => {
    if (msg.type === "offer" && msg.sdp) {
      // Clean up existing connection if any
      if (pcRef.current) {
        pcRef.current.close();
        resetStatsTracking();
      }

      if (!iceConfigRef.current) {
        iceConfigRef.current = await getIceConfig();
      }

      const pc = new RTCPeerConnection(iceConfigRef.current);
      pcRef.current = pc;

      // Handle incoming video stream
      pc.ontrack = (e) => {
        console.log("Received stream from host");
        if (mountedRef.current) {
          setStream(e.streams[0]);
          setLoading(false);
        }
      };

      // Handle data channel (created by host for latency measurement)
      pc.ondatachannel = (e) => {
        const channel = e.channel;
        dataChannelRef.current = channel;

        channel.onopen = () => {
          console.log("Viewer data channel open:", channel.label);
        };

        channel.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (
              data.type === "pong" &&
              pendingPingsRef.current.has(data.id)
            ) {
              const rtt =
                performance.now() - pendingPingsRef.current.get(data.id)!;
              if (mountedRef.current) setLatency(Math.round(rtt / 2));
              pendingPingsRef.current.delete(data.id);
            }
          } catch {
            // Ignore malformed messages
          }
        };
      };

      // ICE candidate handling — send via PartyKit
      pc.onicecandidate = (e) => {
        if (e.candidate && sendSignalRef.current) {
          console.log("Viewer ICE candidate:", e.candidate.type, e.candidate.protocol, e.candidate.address);
          sendSignalRef.current({
            type: "ice-candidate",
            targetId: msg.fromId,
            candidate: e.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("Viewer ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "failed") {
          console.error("ICE connection failed — TURN relay may not be reachable");
          if (mountedRef.current) setConnectionStatus("error");
        } else if (pc.iceConnectionState === "connected") {
          if (mountedRef.current) setConnectionStatus("connected");
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log("Viewer ICE gathering state:", pc.iceGatheringState);
      };

      // Set remote description (the offer)
      await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });

      // Set H.264 preference before creating answer (Task 1.9)
      setH264Preference(pc);

      // Create and send answer via PartyKit
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (sendSignalRef.current) {
        sendSignalRef.current({
          type: "answer",
          targetId: msg.fromId,
          sdp: answer.sdp!,
        });
      }
    } else if (msg.type === "ice-candidate" && msg.candidate) {
      if (pcRef.current) {
        await pcRef.current
          .addIceCandidate(new RTCIceCandidate(msg.candidate))
          .catch((e) => console.error("Error adding ICE candidate:", e));
      }
    }
  }, []);

  // Initialize ICE config on mount
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      iceConfigRef.current = await getIceConfig();
    }
    init();

    // Latency ping every 2 seconds (Task 1.6)
    const pingInterval = setInterval(() => {
      const channel = dataChannelRef.current;
      if (channel && channel.readyState === "open") {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        pendingPingsRef.current.set(id, performance.now());
        channel.send(JSON.stringify({ type: "ping", id }));

        // Clean up old pings (older than 10s)
        const now = performance.now();
        for (const [key, time] of pendingPingsRef.current) {
          if (now - time > 10000) pendingPingsRef.current.delete(key);
        }
      }
    }, 2000);

    // Stats polling (Task 1.8)
    const statsInterval = setInterval(async () => {
      if (pcRef.current && pcRef.current.connectionState === "connected") {
        const s = await getWebRTCStats(pcRef.current);
        if (mountedRef.current) setStats(s);
      }
    }, 2000);

    return () => {
      mountedRef.current = false;
      clearInterval(pingInterval);
      clearInterval(statsInterval);
      if (pcRef.current) pcRef.current.close();
      pendingPingsRef.current.clear();
    };
  }, []);

  return {
    stream,
    connectionStatus,
    loading,
    latency,
    stats,
    setSendSignal,
    handleSignal,
    viewerId,
    setViewerId,
  };
}
