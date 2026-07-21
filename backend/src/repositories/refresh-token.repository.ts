import { prisma } from '../lib/prisma';
export class RefreshTokenRepository {
  create(userId: string, tokenHash: string, expiresAt: Date, device?: string, ip?: string) { return prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt, device, ip } }); }
  findActive(tokenHash: string) { return prisma.refreshToken.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } } }); }
  revoke(id: string) { return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } }); }
  revokeAll(userId: string) { return prisma.refreshToken.updateMany({ where: { userId, revokedAt:null }, data: { revokedAt:new Date() } }); }
}
