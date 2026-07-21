# Redis design

- `presence:{userId}` — online status with a short TTL, refreshed by Socket.IO heartbeat.
- `socket:{userId}` — active socket IDs for notification fan-out.
- `refresh:{tokenId}` — session/rotation allow-list with refresh-token expiry as TTL.
- rate-limit keys — short-lived counters for login and upload protection.

Redis is used for ephemeral, fast-changing data. MySQL remains the source of truth for accounts, friendships, conversations, and messages.
