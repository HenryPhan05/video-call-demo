# Chatting

Production-style real-time chat built with React, TypeScript, Express, Prisma, MySQL, Redis, Socket.IO, and WebRTC.

## Applications

- `frontend/` — React/Vite chat, attachments, voice messages, settings, and voice/video call UI.
- `backend/` — layered Express API, Prisma repositories, Redis-backed Socket.IO, uploads, authentication, and WebRTC signaling.

## Run locally

```powershell
docker compose up -d
npm.cmd install
npm.cmd run dev:backend
npm.cmd run dev:frontend
```

Open `http://localhost:5173`. The API runs at `http://localhost:4000`.

## Production checks

```powershell
npm.cmd run build --workspaces
cd backend
npx.cmd prisma validate
npx.cmd prisma migrate deploy
```

## Realtime communication

Phase 11 includes typed voice-message attachments, hold-to-record waveform UI, Redis presence/socket mapping, Redis Socket.IO adapter, one-to-one voice/video calls, authenticated WebRTC signaling, STUN/TURN configuration, device controls, and persisted call history.

See [Phase 11 realtime documentation](docs/PHASE_11_REALTIME.md).
