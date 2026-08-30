export type ConnectionState =
  | 'idle'
  | 'gathering'
  | 'awaiting-answer'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed';

export type PeerRole = 'none' | 'initiator' | 'joiner' | 'loopback';

export interface PeerStats {
  latencyMs: number | null;
  signalStrength: 0 | 1 | 2 | 3;
}

export type TransferDirection = 'up' | 'down';
export type TransferStatus = 'pending' | 'active' | 'done' | 'error' | 'cancelled';

export interface TransferItem {
  id: string;
  name: string;
  size: number;
  mime: string;
  direction: TransferDirection;
  transferred: number;
  status: TransferStatus;
  speedBps: number;
  startedAt: number;
}

export type ActivityKind = 'connection' | 'clipboard' | 'file' | 'notification' | 'system';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  timestamp: number;
}

export interface MockNotification {
  id: string;
  app: string;
  title: string;
  body: string;
  accent: string;
}

export type QualityLevel = 'auto' | 'high' | 'medium' | 'low';

/** Messages exchanged over the RTCDataChannel as JSON strings. Raw file
 * bytes are sent as separate binary (ArrayBuffer) messages, always
 * immediately preceded by a `file-chunk-header` message naming the chunk. */
export type WireMessage =
  | { type: 'clipboard'; text: string; ts: number }
  | { type: 'notification'; payload: MockNotification; ts: number }
  | { type: 'file-meta'; id: string; name: string; size: number; mime: string; totalChunks: number }
  | { type: 'file-chunk-header'; id: string; index: number }
  | { type: 'file-complete'; id: string }
  | { type: 'file-cancel'; id: string }
  | { type: 'quality-request'; level: QualityLevel }
  | { type: 'ping'; ts: number }
  | { type: 'pong'; ts: number }
  | { type: 'renegotiate-offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'renegotiate-answer'; sdp: RTCSessionDescriptionInit };

/** The one-shot payload embedded in a pairing QR code / copy-paste code.
 * Because there is no signaling server, ICE gathering is run to completion
 * ("vanilla ICE") before this is generated, so it's a single self-contained
 * blob — no live back-and-forth trickle needed. */
export interface SignalPayload {
  kind: 'offer' | 'answer';
  sdp: RTCSessionDescriptionInit;
}

