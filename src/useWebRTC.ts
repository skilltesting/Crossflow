import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActivityItem,
  ConnectionState,
  MockNotification,
  PeerRole,
  PeerStats,
  QualityLevel,
  SignalPayload,
  TransferItem,
  WireMessage,
} from '../types';
import { decodeBase64, encodeBase64, formatBytes, genId } from '../lib/utils';

// 16KB is the widely-supported safe chunk size for RTCDataChannel messages
// across browser SCTP implementations (some allow more, none reliably allow
// less-safe assumptions above it).
const CHUNK_SIZE = 16 * 1024;
// Pause sending once this many bytes are buffered locally, resume on the
// 'bufferedamountlow' event — simple, correct backpressure.
const BUFFERED_AMOUNT_LOW_THRESHOLD = 256 * 1024;
const MAX_ACTIVITY_ITEMS = 120;

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface IncomingFile {
  name: string;
  mime: string;
  size: number;
  totalChunks: number;
  chunks: (ArrayBuffer | undefined)[];
  received: number;
}

function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, timeoutMs);
    function check() {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    }
    pc.addEventListener('icegatheringstatechange', check);
  });
}

function encodePayload(payload: SignalPayload): string {
  return encodeBase64(JSON.stringify(payload));
}

function decodePayload(code: string): SignalPayload {
  const parsed = JSON.parse(decodeBase64(code));
  if (parsed.kind !== 'offer' && parsed.kind !== 'answer') {
    throw new Error('That code is not a valid CrossFlow pairing code.');
  }
  return parsed as SignalPayload;
}

export function useWebRTC() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [role, setRole] = useState<PeerRole>('none');
  const [stats, setStats] = useState<PeerStats>({ latencyMs: null, signalStrength: 0 });
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [remoteClipboard, setRemoteClipboard] = useState<string>('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const loopbackPcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamTrackRef = useRef<MediaStreamTrack | null>(null);

  const incomingFilesRef = useRef<Map<string, IncomingFile>>(new Map());
  const pendingChunkRef = useRef<{ id: string; index: number } | null>(null);
  const cancelledRef = useRef<Set<string>>(new Set());
  const roleRef = useRef<PeerRole>('none');

  const statsIntervalRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);

  const pushActivity = useCallback((item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    setActivity((prev) => [{ id: genId(), timestamp: Date.now(), ...item }, ...prev].slice(0, MAX_ACTIVITY_ITEMS));
  }, []);

  const updateTransfer = useCallback((id: string, patch: Partial<TransferItem>) => {
    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const send = useCallback((dc: RTCDataChannel | null, msg: WireMessage) => {
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify(msg));
  }, []);

  const stopStatsLoop = useCallback(() => {
    if (statsIntervalRef.current) window.clearInterval(statsIntervalRef.current);
    if (pingIntervalRef.current) window.clearInterval(pingIntervalRef.current);
    statsIntervalRef.current = null;
    pingIntervalRef.current = null;
  }, []);

  const startStatsLoop = useCallback(() => {
    stopStatsLoop();
    statsIntervalRef.current = window.setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const report = await pc.getStats();
        let rtt: number | null = null;
        report.forEach((stat: { type: string; state?: string; currentRoundTripTime?: number }) => {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && typeof stat.currentRoundTripTime === 'number') {
            rtt = stat.currentRoundTripTime * 1000;
          }
        });
        if (rtt !== null) {
          setStats({
            latencyMs: Math.round(rtt),
            signalStrength: rtt < 30 ? 3 : rtt < 100 ? 2 : 1,
          });
        }
      } catch {
        // getStats can throw briefly during teardown — safe to ignore.
      }
    }, 2000);

    // Fallback / cross-check latency via an application-level ping — also
    // guarantees a fresh number on browsers that don't expose RTT stats for
    // data-channel-only connections.
    pingIntervalRef.current = window.setInterval(() => {
      send(dcRef.current, { type: 'ping', ts: Date.now() });
    }, 4000);
  }, [send, stopStatsLoop]);

  const finishIncomingFile = useCallback(
    (id: string) => {
      const file = incomingFilesRef.current.get(id);
      if (!file) return;
      const parts = file.chunks.filter((c): c is ArrayBuffer => !!c);
      const blob = new Blob(parts, { type: file.mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      incomingFilesRef.current.delete(id);
      updateTransfer(id, { status: 'done', transferred: file.size });
      pushActivity({ kind: 'file', title: `Received ${file.name}`, detail: formatBytes(file.size) });
    },
    [pushActivity, updateTransfer]
  );

  const applyQualityRequest = useCallback((level: QualityLevel) => {
    const track = localStreamTrackRef.current;
    if (!track) return;
    const presets: Record<QualityLevel, MediaTrackConstraints> = {
      auto: {},
      high: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
      medium: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } },
      low: { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
    };
    track.applyConstraints(presets[level]).catch(() => {
      // Not all captured display tracks accept post-hoc constraint changes —
      // fail silently, the sender simply keeps its current resolution.
    });
  }, []);

  const handleWireMessage = useCallback(
    async (msg: WireMessage, dc: RTCDataChannel) => {
      switch (msg.type) {
        case 'clipboard':
          setRemoteClipboard(msg.text);
          pushActivity({ kind: 'clipboard', title: 'Clipboard synced from peer', detail: msg.text.slice(0, 80) });
          break;
        case 'notification':
          pushActivity({
            kind: 'notification',
            title: `${msg.payload.app} · ${msg.payload.title}`,
            detail: msg.payload.body,
          });
          break;
        case 'file-meta':
          incomingFilesRef.current.set(msg.id, {
            name: msg.name,
            mime: msg.mime,
            size: msg.size,
            totalChunks: msg.totalChunks,
            chunks: new Array(msg.totalChunks),
            received: 0,
          });
          setTransfers((prev) => [
            {
              id: msg.id,
              name: msg.name,
              size: msg.size,
              mime: msg.mime,
              direction: 'down',
              transferred: 0,
              status: 'active',
              speedBps: 0,
              startedAt: Date.now(),
            },
            ...prev,
          ]);
          break;
        case 'file-chunk-header':
          pendingChunkRef.current = { id: msg.id, index: msg.index };
          break;
        case 'file-complete':
          finishIncomingFile(msg.id);
          break;
        case 'file-cancel':
          incomingFilesRef.current.delete(msg.id);
          updateTransfer(msg.id, { status: 'cancelled' });
          pushActivity({ kind: 'file', title: 'Peer cancelled a transfer' });
          break;
        case 'quality-request':
          applyQualityRequest(msg.level);
          pushActivity({ kind: 'system', title: `Peer requested ${msg.level} quality` });
          break;
        case 'ping':
          send(dc, { type: 'pong', ts: msg.ts });
          break;
        case 'pong': {
          const latency = Date.now() - msg.ts;
          setStats((prev) => ({ ...prev, latencyMs: latency, signalStrength: latency < 30 ? 3 : latency < 100 ? 2 : 1 }));
          break;
        }
        case 'renegotiate-offer': {
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(msg.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await waitForIceGatheringComplete(pc, 2000);
          send(dc, { type: 'renegotiate-answer', sdp: pc.localDescription! });
          break;
        }
        case 'renegotiate-answer': {
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(msg.sdp);
          break;
        }
      }
    },
    [applyQualityRequest, finishIncomingFile, pushActivity, send, updateTransfer]
  );

  const handleBinaryChunk = useCallback((data: ArrayBuffer) => {
    const pending = pendingChunkRef.current;
    if (!pending) return;
    pendingChunkRef.current = null;
    const file = incomingFilesRef.current.get(pending.id);
    if (!file) return;
    file.chunks[pending.index] = data;
    file.received += data.byteLength;
    updateTransfer(pending.id, { transferred: file.received });
  }, [updateTransfer]);

  const setupDataChannel = useCallback(
    (dc: RTCDataChannel) => {
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;
      dcRef.current = dc;
      dc.onopen = () => {
        setConnectionState('connected');
        pushActivity({ kind: 'connection', title: 'Peer connected', detail: 'Encrypted P2P channel established' });
        startStatsLoop();
      };
      dc.onclose = () => {
        setConnectionState((prev) => (prev === 'connected' ? 'disconnected' : prev));
        pushActivity({ kind: 'connection', title: 'Peer disconnected' });
        stopStatsLoop();
      };
      dc.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as WireMessage;
            void handleWireMessage(msg, dc);
          } catch {
            // ignore malformed frames
          }
        } else {
          handleBinaryChunk(event.data);
        }
      };
    },
    [handleBinaryChunk, handleWireMessage, pushActivity, startStatsLoop, stopStatsLoop]
  );

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
    pc.ontrack = (event) => setRemoteStream(event.streams[0] ?? null);
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'failed') setConnectionState('failed');
      else if (s === 'disconnected') setConnectionState((prev) => (prev === 'connected' ? 'disconnected' : prev));
      else if (s === 'connecting') {
        setConnectionState((prev) => (prev === 'awaiting-answer' || prev === 'gathering' ? 'connecting' : prev));
      }
    };
    return pc;
  }, []);

  // ---- Pairing (initiator / "host") -------------------------------------
  const createOffer = useCallback(async (): Promise<string> => {
    const pc = createPeerConnection();
    pcRef.current = pc;
    roleRef.current = 'initiator';
    setRole('initiator');
    setConnectionState('gathering');

    const dc = pc.createDataChannel('crossflow');
    setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc, 4000);

    setConnectionState('awaiting-answer');
    pushActivity({ kind: 'connection', title: 'Pairing code generated', detail: 'Waiting for the other device to scan back' });
    return encodePayload({ kind: 'offer', sdp: pc.localDescription! });
  }, [createPeerConnection, pushActivity, setupDataChannel]);

  const completeConnection = useCallback(
    async (answerCode: string) => {
      const payload = decodePayload(answerCode);
      if (payload.kind !== 'answer') throw new Error('Expected an answer code from the other device.');
      const pc = pcRef.current;
      if (!pc) throw new Error('No pairing in progress on this device.');
      await pc.setRemoteDescription(payload.sdp);
      setConnectionState('connecting');
    },
    []
  );

  // ---- Pairing (joiner / "scanner") --------------------------------------
  const createAnswer = useCallback(
    async (offerCode: string): Promise<string> => {
      const payload = decodePayload(offerCode);
      if (payload.kind !== 'offer') throw new Error('Expected an offer code from the host device.');

      const pc = createPeerConnection();
      pcRef.current = pc;
      roleRef.current = 'joiner';
      setRole('joiner');
      pc.ondatachannel = (event) => setupDataChannel(event.channel);

      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      setConnectionState('gathering');
      await waitForIceGatheringComplete(pc, 4000);
      setConnectionState('connecting');
      pushActivity({ kind: 'connection', title: 'Pairing code scanned', detail: 'Show your code back to the host device' });

      return encodePayload({ kind: 'answer', sdp: pc.localDescription! });
    },
    [createPeerConnection, pushActivity, setupDataChannel]
  );

  // ---- Demo / local loopback mode ----------------------------------------
  const setupLoopbackResponder = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';
    channel.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data) as WireMessage;
        if (msg.type === 'clipboard') {
          window.setTimeout(() => {
            if (channel.readyState === 'open') {
              channel.send(JSON.stringify({ type: 'clipboard', text: 'Demo peer says: got it 👋', ts: Date.now() } satisfies WireMessage));
            }
          }, 900);
        }
        if (msg.type === 'notification') {
          window.setTimeout(() => {
            if (channel.readyState === 'open') {
              channel.send(event.data as string);
            }
          }, 700);
        }
        if (msg.type === 'ping') {
          channel.send(JSON.stringify({ type: 'pong', ts: msg.ts } satisfies WireMessage));
        }
      } catch {
        // ignore
      }
    };
  }, []);

  const connectLoopback = useCallback(async () => {
    const pcA = createPeerConnection();
    const pcB = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
    pcA.onicecandidate = (e) => {
      if (e.candidate) pcB.addIceCandidate(e.candidate).catch(() => {});
    };
    pcB.onicecandidate = (e) => {
      if (e.candidate) pcA.addIceCandidate(e.candidate).catch(() => {});
    };
    pcB.ondatachannel = (event) => setupLoopbackResponder(event.channel);

    pcRef.current = pcA;
    loopbackPcRef.current = pcB;
    roleRef.current = 'loopback';
    setRole('loopback');
    setConnectionState('gathering');

    const dc = pcA.createDataChannel('crossflow');
    setupDataChannel(dc);

    const offer = await pcA.createOffer();
    await pcA.setLocalDescription(offer);
    await pcB.setRemoteDescription(offer);
    const answer = await pcB.createAnswer();
    await pcB.setLocalDescription(answer);
    await pcA.setRemoteDescription(answer);

    setConnectionState('connecting');
    pushActivity({ kind: 'system', title: 'Demo mode started', detail: 'Simulating a paired peer on this device' });
  }, [createPeerConnection, pushActivity, setupDataChannel, setupLoopbackResponder]);

  // ---- Teardown -----------------------------------------------------------
  const disconnect = useCallback(() => {
    stopStatsLoop();
    dcRef.current?.close();
    pcRef.current?.close();
    loopbackPcRef.current?.close();
    localStreamTrackRef.current?.stop();
    dcRef.current = null;
    pcRef.current = null;
    loopbackPcRef.current = null;
    localStreamTrackRef.current = null;
    roleRef.current = 'none';
    setRole('none');
    setConnectionState('disconnected');
    setRemoteStream(null);
    setLocalStream(null);
    setStats({ latencyMs: null, signalStrength: 0 });
  }, [stopStatsLoop]);

  useEffect(() => () => disconnect(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Clipboard ------------------------------------------------------------
  const sendClipboard = useCallback(
    (text: string) => {
      send(dcRef.current, { type: 'clipboard', text, ts: Date.now() });
      pushActivity({ kind: 'clipboard', title: 'Clipboard sent to peer', detail: text.slice(0, 80) });
    },
    [pushActivity, send]
  );

  // ---- Files ----------------------------------------------------------------
  const sendFile = useCallback(
    async (file: File) => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== 'open') throw new Error('Not connected to a peer yet.');

      const id = genId();
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      const mime = file.type || 'application/octet-stream';

      setTransfers((prev) => [
        { id, name: file.name, size: file.size, mime, direction: 'up', transferred: 0, status: 'active', speedBps: 0, startedAt: Date.now() },
        ...prev,
      ]);
      send(dc, { type: 'file-meta', id, name: file.name, size: file.size, mime, totalChunks });

      const buffer = await file.arrayBuffer();
      let sent = 0;
      let lastTick = Date.now();
      let lastBytes = 0;

      for (let index = 0; index < totalChunks; index++) {
        if (cancelledRef.current.has(id)) {
          send(dc, { type: 'file-cancel', id });
          updateTransfer(id, { status: 'cancelled' });
          cancelledRef.current.delete(id);
          return;
        }
        while (dc.bufferedAmount > BUFFERED_AMOUNT_LOW_THRESHOLD) {
          await new Promise<void>((resolve) => {
            dc.addEventListener('bufferedamountlow', () => resolve(), { once: true });
          });
        }
        const start = index * CHUNK_SIZE;
        const chunk = buffer.slice(start, Math.min(start + CHUNK_SIZE, buffer.byteLength));
        send(dc, { type: 'file-chunk-header', id, index });
        dc.send(chunk);
        sent += chunk.byteLength;

        const now = Date.now();
        if (now - lastTick > 350) {
          const speed = (sent - lastBytes) / ((now - lastTick) / 1000);
          updateTransfer(id, { transferred: sent, speedBps: speed });
          lastTick = now;
          lastBytes = sent;
        }
      }

      send(dc, { type: 'file-complete', id });
      updateTransfer(id, { transferred: file.size, status: 'done', speedBps: 0 });
      pushActivity({ kind: 'file', title: `Sent ${file.name}`, detail: formatBytes(file.size) });
    },
    [pushActivity, send, updateTransfer]
  );

  const cancelTransfer = useCallback((id: string) => {
    cancelledRef.current.add(id);
    updateTransfer(id, { status: 'cancelled' });
  }, [updateTransfer]);

  // ---- Screen mirroring -------------------------------------------------
  const renegotiate = useCallback(
    async (pc: RTCPeerConnection, dc: RTCDataChannel) => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc, 3000);
      send(dc, { type: 'renegotiate-offer', sdp: pc.localDescription! });
    },
    [send]
  );

  const startScreenShare = useCallback(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    const videoTrack = stream.getVideoTracks()[0];
    localStreamTrackRef.current = videoTrack;
    setLocalStream(stream);
    videoTrack.addEventListener('ended', () => stopScreenShareRef.current());

    if (roleRef.current === 'loopback') {
      // No second physical device exists yet — preview your own capture in
      // the mirror viewport so the full UI/controls can be exercised.
      setRemoteStream(stream);
      pushActivity({ kind: 'system', title: 'Demo screen share started', detail: 'Previewing your own screen (loopback mode)' });
      return;
    }

    const pc = pcRef.current;
    if (!pc) throw new Error('Not connected to a peer yet.');
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    const dc = dcRef.current;
    if (dc) await renegotiate(pc, dc);
    pushActivity({ kind: 'system', title: 'Screen sharing started' });
  }, [pushActivity, renegotiate]);

  const stopScreenShare = useCallback(() => {
    localStreamTrackRef.current?.stop();
    localStreamTrackRef.current = null;
    setLocalStream(null);
    if (roleRef.current === 'loopback') setRemoteStream(null);
    pushActivity({ kind: 'system', title: 'Screen sharing stopped' });
  }, [pushActivity]);

  // Keep a stable ref so the 'ended' listener above always calls the latest version.
  const stopScreenShareRef = useRef(stopScreenShare);
  useEffect(() => {
    stopScreenShareRef.current = stopScreenShare;
  }, [stopScreenShare]);

  const requestQuality = useCallback(
    (level: QualityLevel) => {
      send(dcRef.current, { type: 'quality-request', level });
    },
    [send]
  );

  const pushMockNotification = useCallback(
    (n: MockNotification) => {
      pushActivity({ kind: 'notification', title: `${n.app} · ${n.title}`, detail: n.body });
      send(dcRef.current, { type: 'notification', payload: n, ts: Date.now() });
    },
    [pushActivity, send]
  );

  const clearActivity = useCallback(() => setActivity([]), []);

  return {
    connectionState,
    role,
    stats,
    remoteStream,
    localStream,
    transfers,
    activity,
    remoteClipboard,
    createOffer,
    createAnswer,
    completeConnection,
    connectLoopback,
    disconnect,
    sendClipboard,
    sendFile,
    cancelTransfer,
    startScreenShare,
    stopScreenShare,
    requestQuality,
    pushMockNotification,
    clearActivity,
  };
}

export type UseWebRTCReturn = ReturnType<typeof useWebRTC>;
