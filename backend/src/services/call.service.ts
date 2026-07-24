import { ConversationRepository } from "../repositories/conversation.repository";
import { CallRepository } from "../repositories/call.repository";
import { AppError } from "../utils/app-error";
import { env } from "../config/env";

const calls = new CallRepository();
const conversations = new ConversationRepository();

export class CallService {
  config() {
    const iceServers: {
      urls: string;
      username?: string;
      credential?: string;
    }[] = [
      {
        urls: env.stunUrl,
      },
    ];
    if (env.turnUrl && env.turnUsername && env.turnPassword) {
      iceServers.push({
        urls: env.turnUrl,
        username: env.turnUsername,
        credential: env.turnPassword,
      });
    }
    return {
      iceServers,
    };
  }

  async start(
    conversationId: string,
    callerId: string,
    type: "VOICE" | "VIDEO",
  ) {
    const participantIds = await conversations.participantIds(
      conversationId,
      callerId,
    );
    if (!participantIds) throw new AppError("Conversation not found.", 404);
    if (participantIds.length < 2)
      throw new AppError("A call needs at least two members.", 400);
    const receiverId = participantIds.find((id) => id !== callerId);
    if (!receiverId) throw new AppError("Call recipient not found.", 404);
    if (await calls.findActiveForUsers([callerId, receiverId]))
      throw new AppError("One of the users is already in a call.", 409);
    return calls.create({
      conversationId,
      callerId,
      receiverId,
      participantIds,
      type,
    });
  }

  async participant(callId: string, userId: string) {
    const call = await calls.findForUser(callId, userId);
    if (!call) throw new AppError("Call not found.", 404);
    return call;
  }

  async signalParticipant(
    callId: string,
    userId: string,
    requestedUserId?: string,
  ) {
    const call = await this.participant(callId, userId);
    const sender = call.participants.find(
      (participant) => participant.userId === userId,
    );
    if (!sender || sender.leftAt)
      throw new AppError("You are no longer in this call.", 403);
    const targetUserId =
      requestedUserId ??
      call.participants.find((participant) => participant.userId !== userId)
        ?.userId;
    if (!targetUserId || targetUserId === userId)
      throw new AppError("Call recipient not found.", 404);
    const target = call.participants.find(
      (participant) =>
        participant.userId === targetUserId && !participant.leftAt,
    );
    if (!target) throw new AppError("Call recipient is unavailable.", 404);
    return {
      call,
      targetUserId,
    };
  }

  async accept(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    const participant = call.participants.find(
      (item) => item.userId === userId,
    );
    if (
      call.callerId === userId ||
      participant?.joinedAt ||
      participant?.leftAt ||
      !["RINGING", "ACCEPTED"].includes(call.status)
    )
      throw new AppError("This call can no longer be accepted.", 409);
    return calls.accept(callId, userId);
  }

  async reject(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    const participant = call.participants.find(
      (item) => item.userId === userId,
    );
    if (
      call.callerId === userId ||
      participant?.joinedAt ||
      participant?.leftAt ||
      !["RINGING", "ACCEPTED"].includes(call.status)
    )
      throw new AppError("This call can no longer be rejected.", 409);
    if (call.participants.length === 2)
      return calls.finish(callId, "REJECTED");
    const updated = await calls.leave(callId, userId);
    const remainingInvitees = updated.participants.filter(
      (item) => item.userId !== updated.callerId && !item.leftAt,
    );
    if (!remainingInvitees.length) return calls.finish(callId, "MISSED");
    return updated;
  }

  async cancel(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    if (call.callerId !== userId || call.status !== "RINGING")
      throw new AppError("This call can no longer be cancelled.", 409);
    return calls.finish(callId, "CANCELLED");
  }

  async end(callId: string, userId: string) {
    const call = await this.participant(callId, userId);
    if (!["RINGING", "ACCEPTED"].includes(call.status))
      throw new AppError("This call has already ended.", 409);
    if (call.callerId === userId || call.participants.length === 2)
      return calls.finish(
        callId,
        call.status === "RINGING" ? "MISSED" : "ENDED",
      );
    return calls.leave(callId, userId);
  }

  active(userId: string) {
    return calls.activeForUser(userId);
  }
  history(userId: string) {
    return calls.history(userId);
  }
}
