# Deployment

1. Supply production `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `CLIENT_ORIGIN`.
2. Run `npm ci`, then `npm run prisma:generate --workspace=@chat/backend` and `npm run prisma:migrate --workspace=@chat/backend`.
3. Build with `npm run build`; serve the frontend static output through a CDN/reverse proxy.
4. Run the backend behind HTTPS with `NODE_ENV=production`, secure cookies, persistent object storage for uploads, and a managed MySQL/Redis service.
5. For horizontally scaled Socket.IO, add the Redis Socket.IO adapter and a TURN service for WebRTC.
