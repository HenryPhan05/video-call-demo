import { apiClient } from "./client";

export type User = {
  id: string;
  firstName: string;
  lastName?: string | null;
  username: string;
  name: string;
  email: string;
  avatarColor?: string;
  avatarUrl?: string | null;
};

export type Attachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "ARCHIVE";
  duration?: number | null;
};

export type CallRecord = {
  id: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  type: "VOICE" | "VIDEO";
  status:
    | "RINGING"
    | "ACCEPTED"
    | "REJECTED"
    | "MISSED"
    | "ENDED"
    | "CANCELLED";
  startedAt?: string | null;
  endedAt?: string | null;
  duration?: number | null;
  createdAt: string;
  caller: Pick<User, "id" | "name" | "avatarUrl">;
  receiver: Pick<User, "id" | "name" | "avatarUrl">;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  body?: string;
  createdAt: string;
  editedAt?: string | null;
  attachments?: Attachment[];
  sender?: Pick<User, "id" | "name" | "avatarUrl">;
  replyTo?: {
    id: string;
    body: string | null;
    sender: Pick<User, "id" | "name">;
  } | null;
  reactions?: {
    id: string;
    userId: string;
    emoji: string;
    user?: Pick<User, "id" | "name" | "avatarUrl">;
  }[];
  receipts?: {
    id: string;
    userId: string;
    deliveredAt?: string | null;
    seenAt?: string | null;
  }[];
};

export type Conversation = {
  id: string;
  title: string;
  lastMessage: Message | null;
};

const body = <T>(response: {
  data: {
    data: T;
  };
}) => response.data.data;

export const getMe = () =>
  apiClient
    .get("/users/me", {
      // A hard page load must validate the current access-token cookie. If it
      // has expired, show sign-in instead of silently creating a new access
      // token from the refresh cookie.
      skipAuthRefresh: true,
    })
    .then(
      body<{
        user: User;
      }>,
    );
export const updateCurrentUser = (input: {
  firstName: string;
  lastName: string;
  username: string;
}) =>
  apiClient.patch("/users/me", input).then(
    body<{
      user: User;
    }>,
  );
export const uploadAvatar = (
  file: File,
  onProgress: (progress: number) => void,
) => {
  const data = new FormData();
  data.append("avatar", file);
  return apiClient
    .post("/users/me/avatar", data, {
      onUploadProgress: (event) =>
        onProgress(
          event.total ? Math.round((event.loaded / event.total) * 100) : 0,
        ),
    })
    .then(
      body<{
        user: User;
      }>,
    );
};
export const login = (input: {
 email: string;
 password: string
}) =>
  apiClient.post("/auth/login", input).then(
    body<{
      user: User;
    }>,
  );
export const register = (input: {
  firstName: string;
  lastName?: string;
  username: string;
  email: string;
  password: string;
}) =>
  apiClient.post("/auth/register", input).then(
    body<{
      verificationRequired: true;
      email: string;
    }>,
  );
export const verifyEmail = (input: {
  email: string;
  code: string;
}) =>
  apiClient.post("/auth/verify-email", input).then(
    body<{
      user: User;
    }>,
  );
export const resendVerification = (email: string) =>
  apiClient.post("/auth/resend-verification", {
    email,
  });
export const forgotPassword = (email: string) =>
  apiClient.post("/auth/forgot-password", {
    email,
  });
export const resetPassword = (input: {
  email: string;
  code: string;
  password: string;
}) => apiClient.post("/auth/reset-password", input);
export const logout = () => apiClient.post("/auth/logout");
export const searchUsers = (query: string) =>
  apiClient
    .get("/users", {
      params: {
        q: query,
      },
    })
    .then(body<User[]>);
export const startConversation = (userId: string) =>
  apiClient
    .post("/conversations", {
      userId,
    })
    .then(body<Conversation>);
export const getConversations = () =>
  apiClient.get("/conversations").then(body<Conversation[]>);
export const getMessages = (id: string) =>
  apiClient.get(`/conversations/${id}/messages`).then(body<Message[]>);

export const uploadAttachment = (
  id: string,
  file: File,
  onProgress: (progress: number) => void,
  duration?: number,
) => {
  const data = new FormData();
  data.append("file", file);
  if (duration) data.append("duration", String(duration));
  return apiClient
    .post(`/conversations/${id}/attachments`, data, {
      onUploadProgress: (event) =>
        onProgress(
          event.total ? Math.round((event.loaded / event.total) * 100) : 0,
        ),
    })
    .then(body<Attachment>);
};

export const sendMessage = (
  id: string,
  input: {
    text: string;
    attachmentIds: string[];
    replyToId?: string;
  },
) => apiClient.post(`/conversations/${id}/messages`, input).then(body<Message>);

export const updateMessage = (id: string, text: string) =>
  apiClient
    .patch(`/messages/${id}`, {
      text,
    })
    .then(body<Message>);

export const deleteMessage = (id: string) =>
  apiClient.delete(`/messages/${id}`).then(
    body<{
      id: string;
      conversationId: string;
    }>,
  );

export const toggleReaction = (id: string, emoji: string) =>
  apiClient
    .post(`/messages/${id}/reactions`, {
      emoji,
    })
    .then(body<Message>);

export const markConversationSeen = (id: string) =>
  apiClient.post(`/conversations/${id}/seen`).then(
    body<{
      count: number;
      seenAt: string;
    }>,
  );

export const getCallConfig = () =>
  apiClient.get("/calls/config").then(
    body<{
      iceServers: RTCIceServer[];
    }>,
  );
export const getCallHistory = () =>
  apiClient.get("/calls/history").then(body<CallRecord[]>);
