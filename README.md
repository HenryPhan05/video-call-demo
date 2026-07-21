# Chatting

Chatting is a full-stack, real-time communication application for private conversations between registered users. It combines persistent messaging, media attachments, presence, reactions, voice messages, and one-to-one voice/video calls in a responsive web interface.

This repository is also a full-stack learning project that demonstrates how a React client, an Express API, MySQL, Redis, Socket.IO, and WebRTC work together in one application.

## What can the app do?

- Register with email-code verification, sign in, sign out, and maintain an authenticated session.
- Search for users and start direct conversations.
- Send, edit, soft-delete, reply to, and react to messages.
- Display message delivery/seen state and typing indicators.
- Upload images, videos, audio, voice recordings, PDFs, Word documents, spreadsheets, and ZIP files.
- Preview supported media in the conversation and download protected files.
- Update the current user's display name and avatar.
- Send and manage friend requests.
- Show online presence and last-seen information.
- Record voice messages in the browser.
- Make authenticated one-to-one voice and video calls with WebRTC.
- Store message, attachment, account, relationship, and call history in MySQL.

## System architecture

```text
React + TypeScript frontend
        |
        | HTTPS/REST, HTTP-only cookies, Socket.IO
        v
Express + TypeScript backend
        |
        +-- Controllers -> Services -> Repositories -> Prisma -> MySQL
        |
        +-- Socket.IO -> Redis adapter/presence -> connected clients
        |
        +-- WebRTC signaling -> peer-to-peer audio/video
        |
        +-- Multer -> protected local attachment storage
```

Messages and files are persisted before the server broadcasts their database-backed records to connected users. WebRTC audio/video media travels between peers; Socket.IO is used only for call signaling and realtime application events.

## Frontend

The frontend is located in [`frontend/`](frontend/) and uses:

| Technology            | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| React 19              | Component-based user interface                                           |
| TypeScript            | Static typing for users, conversations, messages, attachments, and calls |
| Vite                  | Development server and production bundler                                |
| TanStack React Query  | Server-state fetching, caching, and refresh                              |
| Axios                 | Authenticated REST requests and upload progress                          |
| Socket.IO Client      | Realtime messages, reactions, typing, presence, and call signaling       |
| WebRTC browser APIs   | Peer-to-peer microphone and camera communication                         |
| MediaRecorder API     | Recording voice messages in the browser                                  |
| Custom responsive CSS | Messenger-style desktop and mobile layout                                |

The frontend and backend are fully integrated. Axios sends cookies with API requests, Socket.IO uses the same authenticated session, and incoming message events retain attachment and reaction metadata so the UI updates without a page refresh.

## Backend

The backend is located in [`backend/`](backend/) and uses:

| Technology              | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| Node.js                 | JavaScript runtime                                                              |
| Express                 | REST API and middleware pipeline                                                |
| TypeScript              | Strictly typed backend application code                                         |
| Prisma ORM              | MySQL schema, migrations, relations, and database queries                       |
| MySQL 8                 | Persistent application database                                                 |
| Redis 7 / ioredis       | Presence, socket mapping, active-call state, and shared realtime infrastructure |
| Socket.IO               | Realtime messages, typing, presence, reactions, and WebRTC signaling            |
| Socket.IO Redis Adapter | Sharing Socket.IO events when multiple backend instances are used               |
| JSON Web Token          | Access-token authentication                                                     |
| bcryptjs                | Password hashing                                                                |
| Multer                  | Avatar and chat attachment uploads                                              |
| Resend                  | HTTPS API delivery of account verification codes                                |
| Zod                     | API request validation                                                          |
| Helmet                  | Security-related HTTP headers                                                   |
| express-rate-limit      | Authentication endpoint rate limiting                                           |
| CORS and cookie-parser  | Cross-origin cookie sessions and cookie parsing                                 |

Backend responsibilities are separated into routes, controllers, services, and repositories. Repositories contain Prisma access, services apply business and authorization rules, controllers produce standardized API responses, and routes connect validation/authentication middleware to controllers.

## Authentication and security

Yes, Chatting uses JWT authentication.

- A 15-minute access token is stored in a secure, HTTP-only cookie.
- A seven-day refresh token is stored in a separate HTTP-only cookie.
- Raw refresh tokens are never stored in MySQL; the backend stores a SHA-256 hash.
- Refresh tokens are rotated and the previous database record is revoked during refresh.
- Passwords are hashed with bcrypt using 12 rounds.
- New accounts receive a six-digit email code and cannot sign in until verified.
- Verification codes expire, are attempt-limited, and are stored only as keyed hashes.
- Verification codes can be resent after a cooldown; resend and verification endpoints are rate limited.
- Socket.IO validates the access-token cookie during its handshake.
- Protected routes verify the authenticated user and conversation membership.
- Attachment view/download endpoints only return files linked to a conversation the user belongs to.
- Zod validates supported request bodies.
- Helmet, CORS, JSON size limits, and authentication rate limiting protect the HTTP layer.

Verification email is delivered through Resend when `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` is configured. Without a Resend key, development mode writes the verification code to the backend terminal so local testing remains possible; production rejects registration if email delivery is not configured. The forgot-password delivery remains mocked locally and writes its reset token to the backend console.

## Database and Prisma

Chatting uses Prisma ORM with MySQL. The schema is in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma), and versioned migrations are in [`backend/prisma/migrations/`](backend/prisma/migrations/).

Important database models include:

- `User`, `RefreshToken`, `PasswordResetToken`, and `EmailVerificationToken`
- `Friend` and `Block`
- `Conversation` and `Participant`
- `Message`, `MessageReaction`, `MessagePin`, `MessageMention`, and `MessageReceipt`
- `Attachment`
- `Call` and `CallParticipant`
- `Notification`

Messages support replies, forwarding references, edited timestamps, soft deletion, attachments, reactions, mentions, pins, and receipts. Database indexes cover common conversation, user, message-history, attachment, and call-history queries.

## Redis and realtime communication

Redis is integrated into the backend for:

- Socket.IO's Redis adapter, enabling shared events across backend instances.
- Online-user presence and multiple browser tabs/devices.
- Mapping Socket.IO connection IDs to users.
- Tracking active call state and reconnecting users to an ongoing call.

If Redis is unavailable during development, the backend logs a warning and continues with a single Socket.IO server. MySQL remains the source of truth for persistent data.

Main realtime events include:

- Messaging: `message:new`, `message:update`, `message:delete`, `message:seen`
- Typing: `typing:start`, `typing:stop`, `typing:update`
- Presence: `presence:update`
- Calls: `call:start`, `call:ringing`, `call:accept`, `call:reject`, `call:cancel`, `call:end`, `call:recover`
- WebRTC: `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`

## File and media support

Multer stores uploaded files under `backend/uploads/`. Filenames are generated with UUIDs instead of trusting the original filename. Metadata and message relations are persisted through Prisma.

Currently supported MIME categories include:

- Images: JPEG, PNG, and WebP
- Videos: MP4 and WebM
- Audio/voice: MP3, WebM, WAV, and OGG
- Documents: PDF, DOC, DOCX, XLS, and XLSX
- Archives: ZIP

The current attachment limit is 25 MB per file, and avatars are limited to 5 MB. Attachment access is authenticated and authorized by conversation membership.

## Project structure

```text
mini-project/
|-- backend/
|   |-- prisma/                 # Prisma schema and MySQL migrations
|   |-- src/
|   |   |-- config/             # Environment configuration
|   |   |-- controllers/        # HTTP request/response handling
|   |   |-- middleware/         # Authentication, validation, uploads, errors
|   |   |-- repositories/       # Prisma database access
|   |   |-- routes/             # REST endpoint definitions
|   |   |-- services/           # Business and authorization rules
|   |   |-- socket/             # Chat, presence, and call events
|   |   |-- utils/              # Tokens, errors, and API responses
|   |   |-- app.ts              # Express application
|   |   `-- server.ts           # HTTP, Socket.IO, and Redis bootstrap
|   `-- uploads/                # Local avatars and attachments
|-- frontend/
|   |-- src/
|   |   |-- api/                # Axios client and typed API functions
|   |   |-- components/chat/    # Attachments, calls, and voice recorder
|   |   |-- App.tsx             # Authentication and main chat workflow
|   |   |-- styles.css          # Main responsive styling
|   |   `-- main.tsx            # React entry point
|   `-- index.html
|-- docs/                       # API, Redis, Socket.IO, ER, and deployment docs
|-- docker-compose.yml          # Local MySQL and Redis services
`-- package.json                # npm workspace scripts
```

## Local development

### Requirements

- Node.js 20 or newer
- npm
- Docker Desktop, or separately installed MySQL 8 and Redis 7
- A modern browser with microphone/camera support for voice and video calls

### 1. Install dependencies

From the repository root:

```powershell
npm.cmd install
```

### 2. Start MySQL and Redis

```powershell
docker compose up -d
```

Docker exposes MySQL on port `3307` and Redis on port `6379`.

### 3. Configure the backend

Copy `backend/.env.example` to `backend/.env`, then use values suitable for your environment. With the included Docker Compose file, a local configuration is:

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="mysql://chatter:chatter_dev_password@localhost:3307/chatter"
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-this-with-a-long-random-secret
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key
RESEND_FROM="chatting@noreply <onboarding@resend.dev>"
EMAIL_VERIFICATION_CODE_TTL_MINUTES=10
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
UPLOAD_DIR=uploads
STUN_URL=stun:stun.l.google.com:19302
TURN_URL=
TURN_USERNAME=
TURN_PASSWORD=
```

TURN is optional for basic local testing but recommended in production because some networks cannot establish a direct WebRTC connection.

### 4. Generate Prisma Client and apply migrations

```powershell
cd backend
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate deploy
cd ..
```

### 5. Run the application

Open two terminals from the repository root.

Backend:

```powershell
npm.cmd run dev:backend
```

Frontend:

```powershell
npm.cmd run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173). The REST API and Socket.IO server run at [http://localhost:4000](http://localhost:4000).

To test realtime behavior, register two different accounts and open them in separate browsers or one normal window and one private window.

## Useful commands

```powershell
# Build both workspaces
npm.cmd run build

# Build only one workspace
npm.cmd run build --workspace=@chat/frontend
npm.cmd run build --workspace=@chat/backend

# Generate Prisma Client
npm.cmd run prisma:generate --workspace=@chat/backend

# Create a development migration
npm.cmd run prisma:migrate --workspace=@chat/backend
```

## Main REST API groups

All application endpoints use the `/api/v1` prefix.

- `/auth` - registration, login, refresh, logout, password change, and password reset
- `/users` - current profile, avatar upload, and user search
- `/conversations` - conversation list, direct-conversation creation, messages, seen state, and attachments
- `/messages` - edit, soft-delete, and reaction operations
- `/friends` - friend list and request lifecycle
- `/attachments` - protected inline viewing and downloads
- `/calls` - WebRTC configuration and persisted call history
- `/health` - service health information

API responses use a consistent shape:

```json
{
  "success": true,
  "message": "Message sent.",
  "data": {}
}
```

## Additional documentation

- [API overview](docs/API.md)
- [Socket.IO events](docs/SOCKET_EVENTS.md)
- [Redis architecture](docs/REDIS.md)
- [MySQL ER diagram](docs/ER_DIAGRAM.md)
- [Voice and video communication](docs/PHASE_11_REALTIME.md)
- [Deployment guide](docs/DEPLOYMENT.md)

## Production notes

Before deploying, use strong secrets, HTTPS, production cookie settings, a managed MySQL/Redis service, durable object storage for uploads, a configured TURN server, reverse-proxy upload limits, monitoring, backups, and a cleanup policy for unlinked files. Run Prisma migrations with `prisma migrate deploy`, not `prisma migrate dev`, in production.
