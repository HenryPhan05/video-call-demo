# Phase 11 — Realtime voice and video

## Voice messages

The browser records `audio/webm` with `MediaRecorder`. The composer previews the recording, then uploads it through the protected conversation attachment endpoint. Attachment rows persist `type=AUDIO` and duration in seconds; the created message persists `type=AUDIO` and contains no synthetic text.

## Call architecture

1. The caller creates a local `RTCPeerConnection`, captures media, and sends `call:start` with its SDP offer.
2. The authenticated Socket.IO server derives the recipient from conversation membership, creates a `Call` row, caches active state in Redis, and emits `call:ringing`.
3. The recipient captures media and sends `call:accept` with its SDP answer.
4. Both peers relay ICE candidates with `webrtc:ice-candidate`; media travels peer-to-peer.
5. Reject, cancel, missed, and ended states update MySQL and clear Redis active-call keys.

Only members of the persisted call can relay signaling messages. The client never chooses an arbitrary signaling recipient.

## Socket.IO events

Client to server:

- `call:start` — `{ conversationId, type, offer }`
- `call:accept` — `{ callId, answer }`
- `call:reject` — `{ callId }`
- `call:cancel` — `{ callId }`
- `call:end` — `{ callId }`
- `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`

Server to client:

- `call:ringing`, `call:accept`, `call:reject`, `call:cancel`, `call:end`
- `call:state`, `call:recover`
- `presence:update`
- WebRTC signaling relay events

## Redis keys

- `presence:{userId}:sockets` — all active tabs/devices for a user.
- `socket:{socketId}:user` — reverse socket mapping.
- `call:active:{callId}` — recoverable active-call metadata with TTL.
- `user:{userId}:active-call` — prevents conflicting calls and supports recovery.

The Socket.IO Redis adapter distributes rooms and events across backend instances.

## Environment variables

```dotenv
STUN_URL=stun:stun.l.google.com:19302
TURN_URL=
TURN_USERNAME=
TURN_PASSWORD=
```

A TURN server is strongly recommended in production because direct peer-to-peer connections do not work across every NAT or corporate network.

## API

- `GET /api/v1/calls/config` — authenticated ICE server configuration.
- `GET /api/v1/calls/history` — authenticated call history for the current user.
