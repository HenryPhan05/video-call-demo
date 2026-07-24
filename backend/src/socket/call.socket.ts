import type { Server, Socket } from "socket.io";
import { CallService } from "../services/call.service";
import { isRedisAvailable, redis } from "../lib/redis";

const calls = new CallService();
const ACTIVE_TTL = 4 * 60 * 60;
type Ack = (result: {
 ok: boolean;
 data?: unknown;
 message?: string
}) => void;

async function cacheActive(call: {
  id: string;
  participants: {
    userId: string;
    leftAt: Date | null;
  }[];
}) {
  if (!isRedisAvailable()) return;

  const transaction = redis
    .multi()
    .set(`call:active:${call.id}`, JSON.stringify(call), "EX", ACTIVE_TTL);
  for (const participant of call.participants)
    if (!participant.leftAt)
      transaction.set(
        `user:${participant.userId}:active-call`,
        call.id,
        "EX",
        ACTIVE_TTL,
      );
  await transaction.exec();
}

async function clearActive(call: {
  id: string;
  participants: {
    userId: string;
  }[];
}) {
  if (!isRedisAvailable()) return;

  await redis.del(
    `call:active:${call.id}`,
    ...call.participants.map(
      (participant) => `user:${participant.userId}:active-call`,
    ),
  );
}

async function clearParticipantActive(userId: string) {
  if (isRedisAvailable()) await redis.del(`user:${userId}:active-call`);
}

const participantIds = (call: {
  participants: {
    userId: string;
    leftAt: Date | null;
  }[];
}) =>
  call.participants
    .filter((participant) => !participant.leftAt)
    .map((participant) => participant.userId);

const emitToParticipants = (
  io: Server,
  call: {
    participants: {
      userId: string;
      leftAt: Date | null;
    }[];
  },
  event: string,
  payload: unknown,
  excludedUserId?: string,
) => {
  for (const participantId of participantIds(call))
    if (participantId !== excludedUserId)
      io.to(`user:${participantId}`).emit(event, payload);
};

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
        emitToParticipants(
          io,
          call,
          "call:ringing",
          {
            call,
          },
          call.callerId,
        );
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
        emitToParticipants(io, call, "call:participant-joined", {
          call,
          userId,
        });
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
        await clearParticipantActive(userId);
        if (["REJECTED", "CANCELLED", "ENDED", "MISSED"].includes(call.status)) {
          await clearActive(call);
          for (const participant of call.participants)
            io.to(`user:${participant.userId}`).emit("call:reject", call);
        } else {
          await cacheActive(call);
          emitToParticipants(
            io,
            call,
            "call:participant-left",
            {
              call,
              userId,
            },
            userId,
          );
        }
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
        for (const participant of call.participants)
          io.to(`user:${participant.userId}`).emit("call:cancel", call);
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
        if (["ENDED", "MISSED"].includes(call.status)) {
          await clearActive(call);
          for (const participant of call.participants)
            io.to(`user:${participant.userId}`).emit("call:end", call);
        } else {
          await clearParticipantActive(userId);
          await cacheActive(call);
          emitToParticipants(
            io,
            call,
            "call:participant-left",
            {
              call,
              userId,
            },
            userId,
          );
        }
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
          toUserId?: string;
        },
        ack?: Ack,
      ) => {
        try {
          if (!payload?.callId) throw new Error("Call ID is required.");
          const {
            call, targetUserId,
          } = await calls.signalParticipant(
            payload.callId,
            userId,
            payload.toUserId,
          );
          if (!["RINGING", "ACCEPTED"].includes(call.status))
            throw new Error("Call has ended.");
          io.to(`user:${targetUserId}`).emit(event, {
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
