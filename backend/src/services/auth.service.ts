import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { AppError } from '../utils/app-error';
import { signAccessToken } from '../utils/token';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { UserRepository } from '../repositories/user.repository';
import { PasswordResetRepository } from '../repositories/password-reset.repository';
const users = new UserRepository(); const refreshTokens = new RefreshTokenRepository(); const resets=new PasswordResetRepository();
const hash = (value:string) => crypto.createHash('sha256').update(value).digest('hex');
export class AuthService {
 async register(input:{name:string;email:string;password:string},meta?:any) { const email=input.email.toLowerCase(); if(await users.findByEmail(email)) throw new AppError('An account with this email already exists.',409); const user=await users.create({name:input.name,email,passwordHash:await bcrypt.hash(input.password,12)}); return this.session(user.id,user,meta); }
 async login(input:{email:string;password:string},meta?:any) { const user=await users.findByEmail(input.email.toLowerCase()); if(!user || !await bcrypt.compare(input.password,user.passwordHash)) throw new AppError('Email or password is incorrect.',401); return this.session(user.id,user,meta); }
 async refresh(raw:string,meta?:any) { const record=await refreshTokens.findActive(hash(raw)); if(!record) throw new AppError('Refresh token reuse detected.',401); await refreshTokens.revoke(record.id); const user=await users.findById(record.userId); if(!user) throw new AppError('User no longer exists.',401); return this.session(user.id,user,meta); }
 async logoutAll(userId:string){await refreshTokens.revokeAll(userId)}
 async changePassword(userId:string,currentPassword:string,password:string){const user=await users.findById(userId);if(!user||!await bcrypt.compare(currentPassword,user.passwordHash))throw new AppError('Current password is incorrect.',400);await users.updatePassword(userId,await bcrypt.hash(password,12));await refreshTokens.revokeAll(userId)}
 async forgotPassword(email:string){const user=await users.findByEmail(email.toLowerCase());if(!user)return;const token=crypto.randomBytes(32).toString('base64url');await resets.create(user.id,hash(token),new Date(Date.now()+3600000));console.info(`Password reset token for ${email}: ${token}`);}
 async resetPassword(token:string,password:string){const record=await resets.find(hash(token));if(!record)throw new AppError('Reset token is invalid or expired.',400);await users.updatePassword(record.userId,await bcrypt.hash(password,12));await resets.use(record.id);await refreshTokens.revokeAll(record.userId)}
 async session(userId:string,user:any,meta?:any) { const refreshToken=crypto.randomBytes(48).toString('base64url'); await refreshTokens.create(userId,hash(refreshToken),new Date(Date.now()+7*86400000),meta?.device,meta?.ip); return { accessToken:signAccessToken(userId),refreshToken,user:{id:user.id,name:user.name,email:user.email,avatarUrl:user.avatarUrl,role:user.role} }; }
}
