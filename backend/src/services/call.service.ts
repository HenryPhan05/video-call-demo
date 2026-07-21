import { ConversationRepository } from '../repositories/conversation.repository';
import { CallRepository } from '../repositories/call.repository';
import { AppError } from '../utils/app-error';
import { env } from '../config/env';

const calls = new CallRepository();
const conversations = new ConversationRepository();

export class CallService {
  config() {
    const iceServers: { urls: string; username?: string; credential?: string }[] = [{ urls: env.stunUrl }];
    if (env.turnUrl && env.turnUsername && env.turnPassword) {
      iceServers.push({ urls: env.turnUrl, username: env.turnUsername, credential: env.turnPassword });
    }
    return { iceServers };
  }

  async start(conversationId: string, callerId: string, type: 'VOICE' | 'VIDEO') {
    const participantIds = await conversations.participantIds(conversationId, callerId);
    if (!participantIds) throw new AppError('Conversation not found.', 404);
    if (participantIds.length !== 2) throw new AppError('Only one-to-one calls are currently supported.', 400);
    const receiverId = participantIds.find((id) => id !== callerId);
    if (!receiverId) throw new AppError('Call recipient not found.', 404);
    if (await calls.findActiveForUsers([callerId, receiverId])) throw new AppError('One of the users is already in a call.', 409);
    return calls.create({ conversationId, callerId, receiverId, type });
  }

  async participant(callId: string, userId: string) {
    const call = await calls.findForUser(callId, userId);
    if (!call) throw new AppError('Call not found.', 404);
    return call;
  }

  async otherParticipant(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    return { call, otherUserId: call.callerId === userId ? call.receiverId : call.callerId };
  }

  async accept(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    if (call.receiverId !== userId || call.status !== 'RINGING') throw new AppError('This call can no longer be accepted.', 409);
    return calls.accept(callId, userId);
  }

  async reject(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    if (call.receiverId !== userId || call.status !== 'RINGING') throw new AppError('This call can no longer be rejected.', 409);
    return calls.finish(callId, 'REJECTED');
  }

  async cancel(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    if (call.callerId !== userId || call.status !== 'RINGING') throw new AppError('This call can no longer be cancelled.', 409);
    return calls.finish(callId, 'CANCELLED');
  }

  async end(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    if (!['RINGING', 'ACCEPTED'].includes(call.status)) throw new AppError('This call has already ended.', 409);
    return calls.finish(callId, call.status === 'RINGING' ? 'MISSED' : 'ENDED');
  }

  active(userId: string) { return calls.activeForUser(userId); }
  history(userId: string) { return calls.history(userId); }
}
