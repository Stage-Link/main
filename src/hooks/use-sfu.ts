"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getIceConfig } from "@/lib/webrtc/ice-config";
import { setH264Preference } from "@/lib/webrtc/sdp-utils";
import { getWebRTCStats, resetStatsTracking, type WebRTCStats } from "@/lib/webrtc/stats";

// ─── Types ──────────────────────────────────────────────────────
export interface SfuTrackInfo {
  sessionId: string;
  trackName: string;
}

// ─── Host Hook ──────────────────────────────────────────────────
export interface UseSfuHostReturn {
  sessionId: string | null;
  trackName: string | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  stats: WebRTCStats | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  replaceTrack: (newTrack: MediaStreamTrack) => Promise<void>;
}

export function useSfuHost(stream: MediaStream | null): UseSfuHostReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [trackName, setTrackName] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [stats, setStats] = useState<WebRTCStats | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep streamRef in sync
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const connect = useCallback(async () => {
    if (!streamRef.current) return;
    if (mountedRef.current) setStatus("connecting");

    try {
      // 1. Create SFU session
      const sessionRes = await fetch("/api/sfu/session", { method: "POST" });
      if (!sessionRes.ok) throw new Error("Failed to create SFU session");
      const sessionData = await sessionRes.json();
      const sid = sessionData.sessionId;
      if (mountedRef.current) setSessionId(sid);

      // 2. Create peer connection with TURN config
      const iceConfig = await getIceConfig();
      const pc = new RTCPeerConnection(iceConfig);
      pcRef.current = pc;

      // 3. Add video track as sendonly
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (!videoTrack) throw new Error("No video track available");

      pc.addTransceiver(videoTrack, { direction: "sendonly" });
      const tName = `video-${Date.now()}`;

      // 4. Create data channel for latency (Task 2.6)
      const dataChannel = pc.createDataChannel("latency", {
        ordered: false,
        maxRetransmits: 0,
      });
      dataChannelRef.current = dataChannel;

      // Respond to pings from viewers (relayed through SFU)
      dataChannel.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "ping") {
            dataChannel.send(JSON.stringify({ type: "pong", id: data.id }));
          }
        } catch {
          // Ignore
        }
      };

      // Set H.264 preference
      setH264Preference(pc);

      // 5. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 6. Push track to Cloudflare
      // After setLocalDescription, transceivers have their `mid` assigned.
      // Cloudflare requires `mid` on each track to map it to the SDP media line.
      const videoTransceiver = pc.getTransceivers().find(
        (t) => t.sender.track?.kind === "video",
      );
      const videoMid = videoTransceiver?.mid ?? "0";

      const trackRes = await fetch("/api/sfu/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          sessionDescription: {
            type: "offer",
            sdp: pc.localDescription!.sdp,
          },
          tracks: [
            {
              location: "local",
              trackName: tName,
              mid: videoMid,
            },
          ],
        }),
      });

      if (!trackRes.ok) throw new Error("Failed to push track to SFU");
      const trackData = await trackRes.json();
      console.log("SFU host trackData:", JSON.stringify(trackData, null, 2));

      // Check for track-level errors (Cloudflare returns 200 even if individual tracks fail)
      if (trackData.tracks) {
        for (const t of trackData.tracks) {
          if (t.errorCode) {
            console.error(`SFU host track error: ${t.errorCode} — ${t.errorDescription}`);
            throw new Error(`SFU track error: ${t.errorCode} — ${t.errorDescription}`);
          }
        }
      }

      if (!trackData.sessionDescription) {
        console.error("SFU host: no sessionDescription in tracks response", trackData);
        throw new Error("SFU returned no session description for host track push");
      }

      // Check if we need immediate renegotiation
      if (trackData.requiresImmediateRenegotiation) {
        // Handle Cloudflare's renegotiation requirement
        await pc.setRemoteDescription({
          type: "answer",
          sdp: trackData.sessionDescription.sdp,
        });

        const newOffer = await pc.createOffer();
        await pc.setLocalDescription(newOffer);

        const renegRes = await fetch("/api/sfu/renegotiate", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            sessionDescription: {
              type: "offer",
              sdp: pc.localDescription!.sdp,
            },
          }),
        });

        if (renegRes.ok) {
          const renegData = await renegRes.json();
          if (renegData.sessionDescription) {
            await pc.setRemoteDescription({
              type: "answer",
              sdp: renegData.sessionDescription.sdp,
            });
          }
        }
      } else {
        // 7. Set answer
        await pc.setRemoteDescription({
          type: "answer",
          sdp: trackData.sessionDescription.sdp,
        });
      }

      if (mountedRef.current) {
        setTrackName(tName);
        setStatus("connected");
      }

      // Stats polling
      resetStatsTracking();
      statsIntervalRef.current = setInterval(async () => {
        if (pcRef.current && pcRef.current.connectionState === "connected") {
          const s = await getWebRTCStats(pcRef.current);
          if (mountedRef.current) setStats(s);
        }
      }, 2000);

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          if (mountedRef.current) setStatus("error");
        }
      };
    } catch (error) {
      console.error("SFU host connect error:", error);
      if (mountedRef.current) setStatus("error");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    dataChannelRef.current = null;
    if (mountedRef.current) {
      setSessionId(null);
      setTrackName(null);
      setStatus("disconnected");
      setStats(null);
    }
  }, []);

  // Task 2.7 — Camera switch without reconnection
  const replaceTrack = useCallback(async (newTrack: MediaStreamTrack) => {
    if (!pcRef.current) return;
    const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  return { sessionId, trackName, status, stats, connect, disconnect, replaceTrack };
}

// ─── Viewer Hook ────────────────────────────────────────────────
export interface UseSfuViewerReturn {
  stream: MediaStream | null;
  status: "disconnected" | "connecting" | "connected" | "error";
  latency: number | null;
  stats: WebRTCStats | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useSfuViewer(
  hostSessionId: string | null,
  hostTrackName: string | null,
): UseSfuViewerReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [latency, setLatency] = useState<number | null>(null);
  const [stats, setStats] = useState<WebRTCStats | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingPingsRef = useRef<Map<string, number>>(new Map());
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mountedRef = useRef(true);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(async () => {
    if (!hostSessionId || !hostTrackName) return;
    if (mountedRef.current) setStatus("connecting");

    try {
      // 1. Create own SFU session
      const sessionRes = await fetch("/api/sfu/session", { method: "POST" });
      if (!sessionRes.ok) throw new Error("Failed to create viewer SFU session");
      const sessionData = await sessionRes.json();
      const sid = sessionData.sessionId;
      sessionIdRef.current = sid;

      // 2. Create peer connection — do NOT add transceivers or create an offer.
      // For pulling remote tracks, Cloudflare generates the offer for us.
      // Reference: cloudflare/realtime-examples/echo/index.html
      const iceConfig = await getIceConfig();
      const pc = new RTCPeerConnection(iceConfig);
      pcRef.current = pc;

      // 3. Handle incoming video stream
      pc.ontrack = (e) => {
        console.log("SFU viewer: received track from Cloudflare", e.track.kind);
        if (mountedRef.current) {
          setStream(e.streams[0] || new MediaStream([e.track]));
          setStatus("connected");
        }
      };

      // Handle data channel (Task 2.6)
      pc.ondatachannel = (e) => {
        const channel = e.channel;
        dataChannelRef.current = channel;

        channel.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === "pong" && pendingPingsRef.current.has(data.id)) {
              const rtt = performance.now() - pendingPingsRef.current.get(data.id)!;
              if (mountedRef.current) setLatency(Math.round(rtt / 2));
              pendingPingsRef.current.delete(data.id);
            }
          } catch {
            // Ignore
          }
        };
      };

      // 4. Request remote tracks from Cloudflare — NO sessionDescription, NO mid.
      // Cloudflare will generate an offer for us with the tracks we want to pull.
      const trackRes = await fetch("/api/sfu/tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          tracks: [
            {
              location: "remote",
              trackName: hostTrackName,
              sessionId: hostSessionId,
            },
          ],
        }),
      });

      if (!trackRes.ok) {
        const errText = await trackRes.text();
        console.error("SFU pull track error:", trackRes.status, errText);
        throw new Error("Failed to pull track from SFU");
      }
      const trackData = await trackRes.json();
      console.log("SFU viewer trackData:", JSON.stringify(trackData, null, 2));

      // Check for track-level errors (Cloudflare returns 200 even if individual tracks fail)
      if (trackData.tracks) {
        for (const t of trackData.tracks) {
          if (t.errorCode) {
            console.error(`SFU viewer track error: ${t.errorCode} — ${t.errorDescription}`);
            throw new Error(`SFU track error: ${t.errorCode} — ${t.errorDescription}`);
          }
        }
      }

      // 5. Handle renegotiation — this is always required when pulling tracks.
      // Cloudflare responds with an OFFER (not an answer), so we:
      //   a) Set it as remoteDescription (offer)
      //   b) Create an answer
      //   c) Set answer as localDescription
      //   d) Send the answer to /renegotiate
      if (trackData.requiresImmediateRenegotiation) {
        if (!trackData.sessionDescription) {
          throw new Error("SFU returned requiresImmediateRenegotiation but no sessionDescription");
        }

        // Cloudflare's response is an OFFER
        await pc.setRemoteDescription(
          new RTCSessionDescription(trackData.sessionDescription),
        );

        // Create our answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Send our answer back to Cloudflare
        const renegRes = await fetch("/api/sfu/renegotiate", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            sessionDescription: {
              type: "answer",
              sdp: answer.sdp,
            },
          }),
        });

        if (!renegRes.ok) {
          const errText = await renegRes.text();
          console.error("SFU renegotiate error:", renegRes.status, errText);
          throw new Error("Failed to renegotiate with SFU");
        }

        const renegData = await renegRes.json();
        if (renegData.errorCode) {
          throw new Error(`SFU renegotiate error: ${renegData.errorDescription}`);
        }
      } else if (trackData.sessionDescription) {
        // Fallback: if no renegotiation needed, just set the description
        await pc.setRemoteDescription(
          new RTCSessionDescription(trackData.sessionDescription),
        );
      } else {
        console.error("SFU: No sessionDescription in tracks response", trackData);
        throw new Error("SFU returned no session description");
      }

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          if (mountedRef.current) setStatus("error");
        }
      };

      // Stats polling
      resetStatsTracking();
      statsIntervalRef.current = setInterval(async () => {
        if (pcRef.current && pcRef.current.connectionState === "connected") {
          const s = await getWebRTCStats(pcRef.current);
          if (mountedRef.current) setStats(s);
        }
      }, 2000);

      // Latency ping (Task 2.6)
      pingIntervalRef.current = setInterval(() => {
        const channel = dataChannelRef.current;
        if (channel && channel.readyState === "open") {
          const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
          pendingPingsRef.current.set(id, performance.now());
          channel.send(JSON.stringify({ type: "ping", id }));

          // Clean old pings
          const now = performance.now();
          for (const [key, time] of pendingPingsRef.current) {
            if (now - time > 10000) pendingPingsRef.current.delete(key);
          }
        }
      }, 2000);
    } catch (error) {
      console.error("SFU viewer connect error:", error);
      if (mountedRef.current) setStatus("error");
    }
  }, [hostSessionId, hostTrackName]);

  const disconnect = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    dataChannelRef.current = null;
    pendingPingsRef.current.clear();
    sessionIdRef.current = null;
    if (mountedRef.current) {
      setStream(null);
      setStatus("disconnected");
      setLatency(null);
      setStats(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  return { stream, status, latency, stats, connect, disconnect };
}
