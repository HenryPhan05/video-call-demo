import type { Server, Socket } from "socket.io";
import { CallService } from "../services/call.service";
import { redis } from "../lib/redis";

const calls = new CallService();
const ACTIVE_TTL = 4 * 60 * 60;
type Ack = (result: {
 ok: boolean;
 data?: unknown;
 message?: string
}) => void;

async function cacheActive(call: {
  id: string;
  callerId: string;
  receiverId: string;
}) {
  await redis
    .multi()
    .set(`call:active:${call.id}`, JSON.stringify(call), "EX", ACTIVE_TTL)
    .set(`user:${call.callerId}:active-call`, call.id, "EX", ACTIVE_TTL)
    .set(`user:${call.receiverId}:active-call`, call.id, "EX", ACTIVE_TTL)
    .exec();
}

async function clearActive(call: {
  id: string;
  callerId: string;
  receiverId: string;
}) {
  await redis.del(
    `call:active:${call.id}`,
    `user:${call.callerId}:active-call`,
    `user:${call.receiverId}:active-call`,
  );
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : "Call operation failed.";

export function registerCallSocket(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  void calls
    .active(userId)
    .then(async (call) => {
      if (!call) return;
      await cacheActive(call);
      socket.emit("call:recover", call);
    })
    .catch(() => undefined);

  socket.on(
    "call:start",
    async (
      payload: {
        conversationId?: string;
        type?: "VOICE" | "VIDEO";
        offer?: unknown;
      },
      ack?: Ack,
    ) => {
      try {
        if (
          !payload?.conversationId ||
          !["VOICE", "VIDEO"].includes(payload.type ?? "")
        )
          throw new Error("Invalid call request.");
        const call = await calls.start(
          payload.conversationId,
          userId,
          payload.type!,
        );
        await cacheActive(call);
        io.to(`user:${call.receiverId}`).emit("call:ringing", {
          call,
          offer: payload.offer,
        });
        io.to(`user:${call.callerId}`).emit("call:state", call);
        ack?.({
          ok: true,
          data: call,
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: message(error),
        });
      }
    },
  );

  socket.on(
    "call:accept",
    async (
      payload: {
        callId?: string;
        answer?: unknown;
      },
      ack?: Ack,
    ) => {
      try {
        if (!payload?.callId) throw new Error("Call ID is required.");
        const call = await calls.accept(payload.callId, userId);
        await cacheActive(call);
        io.to(`user:${call.callerId}`).emit("call:accept", {
          call,
          answer: payload.answer,
        });
        io.to(`user:${call.receiverId}`).emit("call:state", call);
        ack?.({
          ok: true,
          data: call,
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: message(error),
        });
      }
    },
  );

  socket.on(
    "call:reject",
    async (
      payload: {
        callId?: string;
      },
      ack?: Ack,
    ) => {
      try {
        if (!payload?.callId) throw new Error("Call ID is required.");
        const call = await calls.reject(payload.callId, userId);
        await clearActive(call);
        io.to(`user:${call.callerId}`).emit("call:reject", call);
        io.to(`user:${call.receiverId}`).emit("call:state", call);
        ack?.({
          ok: true,
          data: call,
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: message(error),
        });
      }
    },
  );

  socket.on(
    "call:cancel",
    async (
      payload: {
        callId?: string;
      },
      ack?: Ack,
    ) => {
      try {
        if (!payload?.callId) throw new Error("Call ID is required.");
        const call = await calls.cancel(payload.callId, userId);
        await clearActive(call);
        io.to(`user:${call.receiverId}`).emit("call:cancel", call);
        io.to(`user:${call.callerId}`).emit("call:state", call);
        ack?.({
          ok: true,
          data: call,
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: message(error),
        });
      }
    },
  );

  socket.on(
    "call:end",
    async (
      payload: {
        callId?: string;
      },
      ack?: Ack,
    ) => {
      try {
        if (!payload?.callId) throw new Error("Call ID is required.");
        const call = await calls.end(payload.callId, userId);
        await clearActive(call);
        io.to(`user:${call.callerId}`).emit("call:end", call);
        io.to(`user:${call.receiverId}`).emit("call:end", call);
        ack?.({
          ok: true,
          data: call,
        });
      } catch (error) {
        ack?.({
          ok: false,
          message: message(error),
        });
      }
    },
  );

  const relay = (
    event: "webrtc:offer" | "webrtc:answer" | "webrtc:ice-candidate",
  ) => {
    socket.on(
      event,
      async (
        payload: {
          callId?: string;
          offer?: unknown;
          answer?: unknown;
          candidate?: unknown;
        },
        ack?: Ack,
      ) => {
        try {
          if (!payload?.callId) throw new Error("Call ID is required.");
          const {
            call, otherUserId,
          } = await calls.otherParticipant(
            payload.callId,
            userId,
          );
          if (!["RINGING", "ACCEPTED"].includes(call.status))
            throw new Error("Call has ended.");
          io.to(`user:${otherUserId}`).emit(event, {
            ...payload,
            fromUserId: userId,
          });
          ack?.({
            ok: true,
          });
        } catch (error) {
          ack?.({
            ok: false,
            message: message(error),
          });
        }
      },
    );
  };

  relay("webrtc:offer");
  relay("webrtc:answer");
  relay("webrtc:ice-candidate");
}
