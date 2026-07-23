# Chatting

Chatting is a full-stack, real-time communication application for private
conversations between registered users. It combines persistent messaging,
protected media sharing, online presence, voice messages, and one-to-one
voice/video calls in a responsive Messenger-style interface.

The project also demonstrates how a React client, an Express API, Prisma,
MySQL, Redis, Socket.IO, JWT authentication, Gmail OAuth, and WebRTC integrate
in one application.

## Current features

### Accounts and security

- Registration with first name, optional last name, unique username, unique
  email, password confirmation, and a strength indicator.
- Passwords require 8–29 characters with uppercase, lowercase, number, and
  special-character checks.
- Six-digit email verification before the first sign-in.
- A 60-second resend-code cooldown and rate-limited authentication endpoints.
- Login, logout, logout from all devices, password change, forgot password,
  and password reset.
- Password reset also uses a six-digit code delivered by email.
- JWT access and refresh sessions stored in HTTP-only cookies.
- Refresh-token rotation, hashed token storage, reuse prevention, and
  multi-device sessions.

### Conversations and messaging

- Search for an existing username and start a private conversation.
- Persistent text and attachment messages stored in MySQL.
- Send, edit, soft-delete, reply to, and react to messages.
- View who reacted to a message.
- Delivery and seen receipts.
- Automatic unread counts: a new unseen message marks the conversation unread;
  opening and seeing it marks the conversation read.
- Manual **Mark as read** and **Mark as unread** controls.
- Per-user conversation archive and deletion. Archiving or deleting a
  conversation for one user does not remove the other user's copy.
- Realtime Socket.IO updates without refreshing the page.
- Floating responsive typing indicator with the other user's avatar and name.
- Centered, themed confirmation modal for message and conversation deletion.

### Presence

- Realtime online/offline status.
- Green **Online** status in light and dark themes.
- Persisted last-seen timestamps displayed as:
  - `Active just now`
  - `Active 40 minutes ago`
  - `Active 1 hour ago`
  - `Active 1 day ago`
  - `Active 1 week ago`
- Presence snapshots after page refresh or Socket.IO reconnection.
- Multiple tabs/devices are counted before a user is marked offline.

### Files, media, and voice messages

- Drag and drop or use the attachment picker.
- Upload progress and selected-file previews.
- Image, video, audio, PDF, Word, spreadsheet, and ZIP support.
- Images display inline and can be opened in the viewer.
- HTML5 video and audio playback.
- Protected document downloads.
- Browser voice recording with preview, cancel, and send controls.
- Attachment metadata and message relations persisted through Prisma.
- Upload and download authorization based on conversation membership.

### Voice and video calls

- Authenticated one-to-one voice and video calls.
- Incoming, ringing, connected, rejected, cancelled, and ended call states.
- WebRTC offer, answer, and ICE-candidate signaling through Socket.IO.
- Microphone mute/unmute and camera enable/disable controls.
- STUN configuration and optional TURN credentials.
- Call and participant history stored in MySQL.
- Redis-backed active-call state and recovery support.

### User interface

- Responsive desktop, tablet, and mobile chat layout.
- Light and dark themes with a persistent theme preference.
- Glass-style login and registration pages with Three.js background animation.
- Password show/hide controls and inline validation.
- Success notifications after login and email verification.
- Settings page for username, profile details, and avatar.
- Circular avatars throughout conversations and messages.
- Avatar cropper with 100%–200% zoom.
- Unread badge anchored beside each conversation's options button.
- Accessible keyboard focus states and reduced-motion support.

## Architecture

```text
React + TypeScript + Vite
        |
        | REST / HTTP-only cookies / Socket.IO
        v
Express + TypeScript
        |
        +-- Routes
        |     -> Controllers
        |     -> Services
        |     -> Repositories
        |     -> Prisma
        |     -> MySQL
        |
        +-- Socket.IO
        |     -> Redis adapter
        |     -> chat, typing, presence, and WebRTC signaling
        |
        +-- Multer
        |     -> protected local attachment storage
        |
        +-- Gmail API
              -> verification and password-reset email
```

Persistent messages are saved before `message:new` is broadcast. WebRTC
audio/video travels peer-to-peer; Socket.IO carries signaling and realtime
application events.

## Frontend

The frontend is in [`frontend/`](frontend/) and uses:

| Technology | Purpose |
| --- | --- |
| React 19 | Component-based user interface |
| TypeScript | Typed users, conversations, messages, attachments, and calls |
| Vite | Development server and production build |
| TanStack React Query | API state, caching, invalidation, and realtime cache updates |
| Axios | Authenticated API requests and upload progress |
| Socket.IO Client | Messages, receipts, typing, presence, and call signaling |
| WebRTC APIs | Peer-to-peer microphone and camera calls |
| MediaRecorder API | Voice-message recording |
| Three.js | Animated authentication-page background |
| Custom CSS | Responsive Messenger-style UI and light/dark themes |

Important frontend areas:

```text
frontend/src/
|-- api/
|   |-- client.ts                  # Axios instance and auth refresh behavior
|   `-- chat.ts                    # Typed API functions
|-- components/
|   |-- auth/                      # Three.js authentication background
|   |-- chat/                      # Attachments, voice recorder, and calls
|   `-- profile/                   # Avatar cropper
|-- App.tsx                        # Authentication, settings, and chat workflow
|-- styles.css                     # Base application styling
|-- chat-overrides.css             # Current chat, themes, and responsive UI
`-- main.tsx                       # React entry point
```

## Backend

The backend is in [`backend/`](backend/) and uses:

| Technology | Purpose |
| --- | --- |
| Node.js and Express | REST API and middleware pipeline |
| TypeScript | Strict backend typing |
| Prisma 6 | MySQL schema, migrations, relations, and queries |
| MySQL 8 | Persistent application data |
| Redis 7 and ioredis | Presence, socket mapping, active calls, and scaling |
| Socket.IO | Realtime chat, typing, presence, receipts, and signaling |
| Socket.IO Redis Adapter | Cross-instance event delivery |
| JSON Web Token | Access-token authentication |
| bcryptjs | Password hashing with 12 rounds |
| Multer | Avatar and attachment upload handling |
| Gmail API | OAuth 2.0 email delivery |
| Zod | Request validation |
| Helmet | Security-related HTTP headers |
| express-rate-limit | Authentication request limits |
| CORS and cookie-parser | Cross-origin cookies and request parsing |

Backend request flow:

```text
Route -> validation/auth middleware -> Controller -> Service
      -> Repository -> Prisma -> MySQL
```

Controllers handle HTTP input/output, services contain business and
authorization rules, and repositories own Prisma access.

## Authentication details

Chatting uses cookie-based JWT authentication:

- Access token: 15 minutes.
- Refresh token: 7 days.
- Cookies: HTTP-only, `sameSite=lax`, secure in production.
- Refresh tokens: random 48-byte values; only SHA-256 hashes are stored.
- Refresh flow: revoke the previous token, create a new record, and issue new
  cookies.
- Password change/reset: revoke every existing refresh session.
- Socket.IO: verifies the access-token cookie during the handshake.

Verification and password-reset codes:

- Six numeric digits.
- HMAC-hashed before database storage.
- Configurable expiry, defaulting to 10 minutes.
- Maximum of five invalid attempts per issued code.
- Replaced and invalidated when a new code is issued.
- Delivered through the Gmail API using only the `gmail.send` scope.

## Database and Prisma

The Prisma schema is
[`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Versioned MySQL
migrations are under [`backend/prisma/migrations/`](backend/prisma/migrations/).

Main models:

- Authentication: `User`, `RefreshToken`, `EmailVerificationToken`,
  `PasswordResetToken`
- Social: `Friend`, `Block`
- Chat: `Conversation`, `Participant`, `Message`
- Messaging details: `MessageReaction`, `MessagePin`, `MessageMention`,
  `MessageReceipt`
- Media: `Attachment`
- Calls: `Call`, `CallParticipant`
- Other: `Notification`

The `Participant` record stores user-specific conversation state such as
`unreadCount`, `lastReadAt`, `archivedAt`, `deletedAt`, and `clearedAt`.
`User.lastSeenAt` stores the persistent offline timestamp.

## Redis and Socket.IO

Redis is used for:

- Socket.IO's Redis adapter for multiple backend instances.
- User-to-socket mapping.
- Multiple-tab/device presence.
- Active-call tracking and call recovery.

If Redis is unavailable in development, the backend logs one warning and
continues as a single Socket.IO node. MySQL remains the persistent source of
truth.

Current realtime events include:

- Messages: `message:new`, `message:update`, `message:delete`, `message:seen`
- Typing: `typing:start`, `typing:stop`, `typing:update`
- Presence: `presence:request`, `presence:snapshot`, `presence:update`
- Calls: `call:start`, `call:ringing`, `call:accept`, `call:reject`,
  `call:cancel`, `call:end`, `call:recover`
- WebRTC: `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`

## Upload support

Multer stores local files under `backend/uploads/` with UUID-based stored
filenames. The application never trusts the original filename as a filesystem
path.

| Category | Supported formats |
| --- | --- |
| Images | JPEG, PNG, WebP |
| Video | MP4, WebM |
| Audio/voice | MP3, WebM, WAV, OGG |
| Documents | PDF, DOC, DOCX, XLS, XLSX |
| Archives | ZIP |

- Attachment limit: 25 MB per file.
- Avatar limit: 5 MB.
- Avatars are public profile media.
- Conversation attachments require authentication and membership for inline
  viewing or downloading.

## Repository structure

```text
mini-project/
|-- backend/
|   |-- prisma/
|   |   |-- schema.prisma
|   |   `-- migrations/
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- repositories/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- socket/
|   |   |-- utils/
|   |   |-- app.ts
|   |   `-- server.ts
|   `-- uploads/
|-- frontend/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- App.tsx
|   |   |-- styles.css
|   |   `-- chat-overrides.css
|   `-- index.html
|-- docs/
|-- docker-compose.yml
|-- package.json
`-- README.md
```

## Local development

### Requirements

- Node.js 20 or newer
- npm
- Docker Desktop, or local MySQL 8 and Redis 7 installations
- A modern browser with microphone and camera support

### 1. Install dependencies

From the repository root:

```powershell
npm.cmd install
```

### 2. Start MySQL and Redis

```powershell
docker compose up -d
```

The included Compose configuration exposes:

- MySQL: `localhost:3307`
- Redis: `localhost:6379`

### 3. Configure the backend

Copy `backend/.env.example` to `backend/.env`.

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="mysql://chatter:chatter_dev_password@localhost:3307/chatter"
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-a-long-random-secret

ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7

GMAIL_CLIENT_ID=your_google_oauth_client_id
GMAIL_CLIENT_SECRET=your_google_oauth_client_secret
GMAIL_REFRESH_TOKEN=your_google_oauth_refresh_token
GMAIL_SENDER_EMAIL=your-sender@gmail.com
GMAIL_SENDER_NAME=Chatting
EMAIL_VERIFICATION_CODE_TTL_MINUTES=10
PASSWORD_RESET_CODE_TTL_MINUTES=10

UPLOAD_DIR=uploads
STUN_URL=stun:stun.l.google.com:19302
TURN_URL=
TURN_USERNAME=
TURN_PASSWORD=
```

Do not commit `.env`, Gmail tokens, database passwords, JWT secrets, or TURN
credentials.

### 4. Configure Gmail email delivery

1. Open [Google Cloud Console](https://console.cloud.google.com/), create or
   select a project, and enable the Gmail API.
2. Configure the Google OAuth consent screen. For testing, add the sender Gmail
   account as a test user.
3. Add only `https://www.googleapis.com/auth/gmail.send`.
4. Create an OAuth client of type **Web application**.
5. Add `https://developers.google.com/oauthplayground` as an authorized
   redirect URI.
6. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground),
   enable **Use your own OAuth credentials**, and enter your client ID/secret.
7. Authorize the `gmail.send` scope and exchange the code for a refresh token.
8. Put the client ID, client secret, refresh token, sender email, and sender
   name in `backend/.env`.
9. Restart the backend.

The sender email must be the Google account that granted consent. Google may
expire refresh tokens for an external app left in Testing mode.

### 5. Prepare Prisma

```powershell
cd backend
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate deploy
cd ..
```

Use `prisma migrate dev --name <migration_name>` only when creating a new local
development migration.

### 6. Run the application

Backend terminal:

```powershell
npm.cmd run dev:backend
```

Frontend terminal:

```powershell
npm.cmd run dev:frontend
```

Open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend/API and Socket.IO: [http://localhost:4000](http://localhost:4000)

For realtime testing, use two registered accounts in different browser
profiles, or one normal and one private window.

## Useful commands

```powershell
# Build both npm workspaces
npm.cmd run build

# Build only one workspace
npm.cmd run build --workspace=@chat/frontend
npm.cmd run build --workspace=@chat/backend

# Validate and generate Prisma Client
cd backend
npx.cmd prisma validate
npx.cmd prisma generate

# Apply committed migrations
npx.cmd prisma migrate deploy
```

## Main API groups

All API routes use the `/api/v1` prefix.

- `/auth` — register, verify email, resend code, login, refresh, logout,
  logout-all, password change, forgot password, and reset password
- `/users` — current profile, avatar upload, and username search
- `/conversations` — list/create conversations, read state, archive,
  per-user delete, messages, seen state, and attachment upload
- `/messages` — edit, soft-delete, and reactions
- `/friends` — backend friend list and friend-request lifecycle
- `/attachments` — protected inline viewing and downloads
- `/calls` — WebRTC configuration and call history
- `/health` — service health

API responses use a consistent envelope:

```json
{
  "success": true,
  "message": "Message sent.",
  "data": {}
}
```

## Testing checklist

1. Register two accounts and verify both six-digit email codes.
2. Sign into each account in a separate browser session.
3. Search for the other username and open a conversation.
4. Send a text message and confirm the unread badge appears for the recipient.
5. Open the conversation and confirm it changes to read/seen.
6. Confirm typing, online status, and last-active status update in realtime.
7. Upload an image, video, audio file, PDF, and document.
8. Confirm an unrelated account cannot view or download the attachment.
9. Record and send a voice message.
10. Test message reactions, reply, edit, and the custom delete modal.
11. Archive/delete a conversation and confirm it affects only that user.
12. Test a voice call and a video call between both sessions.
13. Switch light/dark themes and test desktop and mobile widths.

## Troubleshooting

### `EADDRINUSE: port 4000`

Another backend process is already using port 4000. Stop that process before
starting another development server:

```powershell
Get-NetTCPConnection -LocalPort 4000
```

Then stop the matching process from Task Manager or with `Stop-Process` after
confirming the correct PID.

### Redis unavailable

Start Redis:

```powershell
docker compose up -d redis
```

The application can run without Redis as a single Socket.IO node, but
cross-instance events and Redis-backed recovery require it.

### Gmail sends no code

- Confirm all four `GMAIL_*` credential values exist.
- Confirm Gmail API is enabled.
- Confirm the refresh token was created with your own OAuth client and the
  `gmail.send` scope.
- Confirm the sender email matches the account that granted consent.
- Restart the backend after editing `.env`.
- Check spam and the Gmail sent folder.

### Prisma cannot connect

Confirm MySQL is healthy and that `DATABASE_URL` uses port `3307` with the
included Docker Compose configuration:

```powershell
docker compose ps
npx.cmd prisma validate
```

## Additional documentation

- [API overview](docs/API.md)
- [Socket.IO events](docs/SOCKET_EVENTS.md)
- [Redis architecture](docs/REDIS.md)
- [MySQL ER diagram](docs/ER_DIAGRAM.md)
- [Voice and video communication](docs/PHASE_11_REALTIME.md)
- [Deployment guide](docs/DEPLOYMENT.md)

## Production notes

Before deployment:

- Use HTTPS and strong production secrets.
- Use managed MySQL and Redis with backups.
- Use durable object storage instead of local disk for uploaded files.
- Configure a TURN server for reliable WebRTC connectivity.
- Restrict CORS to the deployed frontend origin.
- Configure reverse-proxy upload limits.
- Add logging, monitoring, rate-limit storage, and orphan-file cleanup.
- Run `prisma migrate deploy`, never `prisma migrate dev`, in production.

