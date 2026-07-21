import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import axios from "axios";

import {
  deleteMessage,
  getConversations,
  getMe,
  getMessages,
  login,
  logout,
  markConversationSeen,
  Message,
  register,
  searchUsers,
  sendMessage,
  startConversation,
  toggleReaction,
  updateCurrentUser,
  updateMessage,
  uploadAttachment,
  uploadAvatar,
  User,
} from "./api/chat";
import { AttachmentPicker } from "./components/chat/AttachmentPicker";
import { FileDropZone } from "./components/chat/FileDropZone";
import { AttachmentPreview } from "./components/chat/AttachmentPreview";
import { AttachmentMessage } from "./components/chat/AttachmentMessage";
import { VoiceRecorder } from "./components/chat/VoiceRecorder";
import { CallManager } from "./components/chat/CallManager";

const SOCKET_URL = "http://localhost:4000";
const avatarUrl = (url?: string | null) => (url ? `${SOCKET_URL}${url}` : "");

export function App() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
  });
  if (me.isLoading)
    return (
      <main className="auth">
        <h1>Chatting</h1>
        <p>Loading...</p>
      </main>
    );
  return me.data ? <Chat user={me.data.user} /> : <Auth />;
}

function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      mode === "login"
        ? login({
          email,
          password,
        })
        : register({
          name,
          email,
          password,
        }),
    onSuccess: () => location.reload(),
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      setError(
        message ?? "Authentication failed. Check your details and try again.",
      );
    },
  });

  return (
    <main className="auth">
      <h1>Chatting</h1>
      <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {mode === "register" && (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            minLength={2}
            required
          />
        )}
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="Email"
          required
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Password"
          minLength={8}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setError("");
            setMode((current) => (current === "login" ? "register" : "login"));
          }}
        >
          {mode === "login"
            ? "Need an account? Register"
            : "Already registered? Sign in"}
        </button>
      </form>
    </main>
  );
}

function Chat({
  user,
}: {
 user: User
}) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [draft, setDraft] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [sendError, setSendError] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState<"chat" | "settings">("chat");
  const [socketClient, setSocketClient] = useState<Socket | null>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
  });
  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages(conversationId),
    enabled: Boolean(conversationId),
  });
  const userResults = useQuery({
    queryKey: ["user-search", userQuery],
    queryFn: () => searchUsers(userQuery),
    enabled: userQuery.trim().length >= 2,
  });
  const activeConversation = conversations.data?.find(
    (conversation) => conversation.id === conversationId,
  );

  useEffect(() => {
    if (!conversationId && conversations.data?.[0])
      setConversationId(conversations.data[0].id);
  }, [conversations.data, conversationId]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
    });
    socketRef.current = socket;
    setSocketClient(socket);

    socket.on("message:new", (message: Message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) =>
          current.some((item) => item.id === message.id)
            ? current
            : [...current, message],
      );
      void queryClient.invalidateQueries({
        queryKey: ["conversations"],
      });
    });
    socket.on("message:update", (message: Message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) =>
          current.map((item) => (item.id === message.id ? message : item)),
      );
    });
    socket.on("message:delete", (message: Message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) => current.filter((item) => item.id !== message.id),
      );
      void queryClient.invalidateQueries({
        queryKey: ["conversations"],
      });
    });
    socket.on(
      "message:seen",
      ({
        conversationId: seenConversationId,
      }: {
 conversationId: string
}) => {
        void queryClient.invalidateQueries({
          queryKey: ["messages", seenConversationId],
        });
      },
    );
    socket.on(
      "typing:update",
      ({
        conversationId: typingConversationId,
        userId,
        isTyping,
      }: {
        conversationId: string;
        userId: string;
        isTyping: boolean;
      }) => {
        setTypingUsers((current) => {
          const users = new Set(current[typingConversationId] ?? []);
          isTyping ? users.add(userId) : users.delete(userId);
          return {
            ...current,
            [typingConversationId]: [...users],
          };
        });
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketClient(null);
    };
  }, [queryClient]);

  useEffect(() => {
    const hasUnseen = messages.data?.some(
      (message) =>
        message.senderId !== user.id &&
        message.receipts?.some(
          (receipt) => receipt.userId === user.id && !receipt.seenAt,
        ),
    );
    if (conversationId && hasUnseen) {
      void markConversationSeen(conversationId);
    }
  }, [conversationId, messages.dataUpdatedAt, messages.data, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [conversationId, messages.data?.length]);

  const startChat = useMutation({
    mutationFn: startConversation,
    onSuccess: async (conversation) => {
      setUserQuery("");
      await queryClient.invalidateQueries({
        queryKey: ["conversations"],
      });
      setConversationId(conversation.id);
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      setSendError("");
      if (editing) return updateMessage(editing.id, draft);

      const outgoingFiles = voiceFile ? [voiceFile] : files;
      const attachmentIds = await Promise.all(
        outgoingFiles.map((file, index) =>
          uploadAttachment(
            conversationId,
            file,
            (percent) => {
              setProgress((current) => ({
                ...current,
                [`${file.name}-${index}`]: percent,
              }));
            },
            voiceFile ? voiceDuration : undefined,
          ).then((attachment) => attachment.id),
        ),
      );
      return sendMessage(conversationId, {
        text: voiceFile ? "" : draft,
        attachmentIds,
        replyToId: replyTo?.id,
      });
    },
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) => {
          const existing = current.some((item) => item.id === message.id);
          return existing
            ? current.map((item) => (item.id === message.id ? message : item))
            : [...current, message];
        },
      );
      setDraft("");
      setFiles([]);
      setVoiceFile(null);
      setVoiceDuration(0);
      setRecordingVoice(false);
      setProgress({});
      setReplyTo(null);
      setEditing(null);
      socketRef.current?.emit("typing:stop", {
        conversationId,
      });
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      setSendError(message ?? "The message or attachment could not be sent.");
    },
  });

  const react = useMutation({
    mutationFn: ({
      messageId, emoji,
    }: {
 messageId: string;
 emoji: string
}) =>
      toggleReaction(messageId, emoji),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) =>
          current.map((item) => (item.id === message.id ? message : item)),
      );
    },
  });
  const remove = useMutation({
    mutationFn: deleteMessage,
    onError: () => setSendError("The message could not be deleted."),
  });

  const selectConversation = (id: string) => {
    if (recordingVoice) return;
    if (conversationId)
      socketRef.current?.emit("typing:stop", {
        conversationId,
      });
    setConversationId(id);
    setReplyTo(null);
    setEditing(null);
    setDraft("");
    setFiles([]);
    setVoiceFile(null);
    setVoiceDuration(0);
    setProgress({});
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!conversationId) return;
    socketRef.current?.emit(value ? "typing:start" : "typing:stop", {
      conversationId,
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (value) {
      typingTimer.current = setTimeout(() => {
        socketRef.current?.emit("typing:stop", {
          conversationId,
        });
      }, 1200);
    }
  };

  const beginEdit = (message: Message) => {
    setEditing(message);
    setReplyTo(null);
    setFiles([]);
    setVoiceFile(null);
    setVoiceDuration(0);
    setRecordingVoice(false);
    setDraft(message.text ?? message.body ?? "");
  };

  return (
    <div className="chat">
      <aside>
        <div className="sidebar-top">
          <p className="brand">CHATTING</p>
        </div>
        <button
          className="profile profile-button"
          type="button"
          onClick={() => setPage("settings")}
        >
          <span className="profile-avatar">
            {user.avatarUrl ? (
              <img src={avatarUrl(user.avatarUrl)} alt="" />
            ) : (
              user.name[0]?.toUpperCase()
            )}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>Online</small>
          </div>
        </button>
        <label>
          Find someone
          <input
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder="Search by name"
          />
        </label>
        {userResults.data
          ?.filter((result) => result.id !== user.id)
          .map((result) => (
            <button
              className="conversation"
              key={result.id}
              onClick={() => startChat.mutate(result.id)}
              disabled={startChat.isPending || recordingVoice}
            >
              <span className="avatar">{result.name[0]?.toUpperCase()}</span>
              <span>
                <strong>{result.name}</strong>
                <small>Start conversation</small>
              </span>
            </button>
          ))}
        <p className="section-label">CONVERSATIONS</p>
        {conversations.data?.map((conversation) => (
          <button
            className={`conversation ${conversation.id === conversationId && page === "chat" ? "active" : ""}`}
            key={conversation.id}
            onClick={() => {
              setPage("chat");
              selectConversation(conversation.id);
            }}
            disabled={recordingVoice}
          >
            <span className="avatar">
              {conversation.title[0]?.toUpperCase()}
            </span>
            <span>
              <strong>{conversation.title}</strong>
              <small>
                {conversation.lastMessage?.text ??
                  conversation.lastMessage?.body ??
                  "No messages yet"}
              </small>
            </span>
          </button>
        ))}
        <button
          className={`settings-link ${page === "settings" ? "active" : ""}`}
          type="button"
          onClick={() => setPage("settings")}
        >
          ⚙ Settings
        </button>
        <button onClick={() => logout().then(() => location.reload())}>
          Sign out
        </button>
      </aside>

      {page === "settings" ? (
        <SettingsPage user={user} onBack={() => setPage("chat")} />
      ) : (
        <main className="thread">
          {!conversationId && (
            <div className="empty">
              Search for another registered user to start chatting.
            </div>
          )}
          {activeConversation && (
            <header className="chat-header">
              <span className="avatar large">
                {activeConversation.title[0]?.toUpperCase()}
              </span>
              <div>
                <h2>{activeConversation.title}</h2>
                <p>Active conversation</p>
              </div>
            </header>
          )}

          <div className="messages">
            {messages.data?.map((message) => {
              const mine = message.senderId === user.id;
              const reactionGroups = Object.entries(
                (message.reactions ?? []).reduce<
                  Record<string, NonNullable<Message["reactions"]>>
                >((groups, reaction) => {
                  (groups[reaction.emoji] ??= []).push(reaction);
                  return groups;
                }, {}),
              );
              const seen = message.receipts?.some((receipt) =>
                Boolean(receipt.seenAt),
              );
              return (
                <div
                  className={`message ${mine ? "mine" : "theirs"}`}
                  key={message.id}
                >
                  {message.replyTo && (
                    <div className="reply-quote">
                      <strong>{message.replyTo.sender.name}</strong>
                      <span>{message.replyTo.body ?? "Attachment"}</span>
                    </div>
                  )}
                  {(message.text ?? message.body) && (
                    <p>{message.text ?? message.body}</p>
                  )}
                  {message.attachments?.map((attachment) => (
                    <AttachmentMessage
                      key={attachment.id}
                      attachment={attachment}
                    />
                  ))}
                  {reactionGroups.length > 0 && (
                    <details className="reaction-details">
                      <summary className="reaction-summary">
                        {reactionGroups.map(([emoji, reactions]) => (
                          <span key={emoji}>
                            {emoji} {reactions.length}
                          </span>
                        ))}
                      </summary>
                      <div className="reaction-people">
                        {(message.reactions ?? []).map((reaction) => (
                          <div key={reaction.id}>
                            <span className="mini-avatar">
                              {reaction.user?.name[0]?.toUpperCase() ?? "?"}
                            </span>
                            <strong>{reaction.user?.name ?? "User"}</strong>
                            <span>{reaction.emoji}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="message-meta">
                    <time>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {message.editedAt && <span>Edited</span>}
                    {mine && <span>{seen ? "Seen" : "Delivered"}</span>}
                  </div>
                  <div className="message-actions">
                    <button type="button" onClick={() => setReplyTo(message)}>
                      Reply
                    </button>
                    {["👍", "❤️", "😂"].map((emoji) => (
                      <button
                        type="button"
                        aria-label={`React ${emoji}`}
                        key={emoji}
                        onClick={() =>
                          react.mutate({
                            messageId: message.id,
                            emoji,
                          })
                        }
                      >
                        {emoji}
                      </button>
                    ))}
                    {mine && (
                      <button type="button" onClick={() => beginEdit(message)}>
                        Edit
                      </button>
                    )}
                    {mine && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Delete this message for everyone?"))
                            remove.mutate(message.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {Boolean(typingUsers[conversationId]?.length) && (
              <div className="typing-indicator">
                <span />
                <span />
                <span /> typing
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <FileDropZone
            disabled={Boolean(editing || recordingVoice || voiceFile)}
            onFiles={(newFiles) =>
              !editing &&
              !recordingVoice &&
              !voiceFile &&
              setFiles((current) => [...current, ...newFiles])
            }
          >
            <form
              className="composer"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                if (
                  (draft.trim() || files.length || voiceFile) &&
                  !recordingVoice &&
                  !send.isPending
                )
                  send.mutate();
              }}
            >
              {(replyTo || editing) && (
                <div className="composer-context">
                  <span>
                    <strong>
                      {editing
                        ? "Editing message"
                        : `Replying to ${replyTo?.sender?.name ?? "message"}`}
                    </strong>
                    {!editing && (replyTo?.text ?? replyTo?.body)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null);
                      setEditing(null);
                      setDraft("");
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {!editing &&
                files.map((file, index) => (
                  <div
                    className="selected-attachment"
                    key={`${file.name}-${index}`}
                  >
                    <AttachmentPreview file={file} />
                    {send.isPending && (
                      <progress
                        max="100"
                        value={progress[`${file.name}-${index}`] ?? 0}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              {!editing && voiceFile && (
                <div className="selected-attachment voice-ready">
                  <AttachmentPreview file={voiceFile} />
                  {send.isPending && (
                    <progress
                      max="100"
                      value={progress[`${voiceFile.name}-0`] ?? 0}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceFile(null);
                      setVoiceDuration(0);
                    }}
                  >
                    Remove recording
                  </button>
                </div>
              )}
              {!editing && (
                <AttachmentPicker
                  disabled={recordingVoice || Boolean(voiceFile)}
                  onFiles={(newFiles) =>
                    setFiles((current) => [...current, ...newFiles])
                  }
                />
              )}
              {!editing && (
                <VoiceRecorder
                  disabled={files.length > 0 || Boolean(voiceFile)}
                  onRecordingChange={(recording) => {
                    setRecordingVoice(recording);
                    if (recording) {
                      setDraft("");
                      socketRef.current?.emit("typing:stop", {
                        conversationId,
                      });
                    }
                  }}
                  onRecorded={(file, duration) => {
                    setVoiceFile(file);
                    setVoiceDuration(duration);
                    setDraft("");
                  }}
                />
              )}
              {sendError && <p className="error composer-error">{sendError}</p>}
              <input
                value={draft}
                disabled={recordingVoice || Boolean(voiceFile)}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={
                  editing
                    ? "Edit message"
                    : voiceFile
                      ? "Voice message ready"
                      : recordingVoice
                        ? "Recording voice message..."
                        : "Write a message"
                }
              />
              <button
                disabled={
                  recordingVoice ||
                  send.isPending ||
                  (!draft.trim() && !files.length && !voiceFile)
                }
              >
                {editing ? "Save" : "Send"}
              </button>
            </form>
          </FileDropZone>
        </main>
      )}
      <CallManager
        socket={socketClient}
        conversationId={conversationId}
        conversationTitle={activeConversation?.title}
        user={user}
        enabled={page === "chat" && Boolean(conversationId)}
      />
    </div>
  );
}

function SettingsPage({
  user, onBack,
}: {
 user: User;
 onBack: () => void
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState(avatarUrl(user.avatarUrl));
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!avatar) {
      setPreview(avatarUrl(user.avatarUrl));
      return;
    }
    const objectUrl = URL.createObjectURL(avatar);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatar, user.avatarUrl]);

  const save = useMutation({
    mutationFn: async () => {
      setError("");
      setSuccess("");
      let updated = user;
      if (name.trim() !== user.name)
        updated = (
          await updateCurrentUser({
            name: name.trim(),
          })
        ).user;
      if (avatar) updated = (await uploadAvatar(avatar, setProgress)).user;
      return updated;
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(["me"], {
        user: updated,
      });
      setAvatar(null);
      setProgress(0);
      setSuccess("Your profile has been updated.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversations"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["messages"],
        }),
      ]);
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      setError(message ?? "Your profile could not be updated.");
      void queryClient.invalidateQueries({
        queryKey: ["me"],
      });
    },
  });

  return (
    <main className="settings-page">
      <header className="settings-header">
        <button type="button" onClick={onBack} aria-label="Back to messages">
          ←
        </button>
        <div>
          <h2>Settings</h2>
          <p>Manage your public chat profile</p>
        </div>
      </header>
      <section className="settings-card">
        <div className="settings-avatar">
          <span>
            {preview ? (
              <img src={preview} alt="Avatar preview" />
            ) : (
              name[0]?.toUpperCase()
            )}
          </span>
          <div>
            <h3>Profile photo</h3>
            <p>JPG, PNG or WebP. Maximum 5 MB.</p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) save.mutate();
          }}
        >
          <label className="settings-field">
            <span>Change avatar</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setError("");
                if (file && file.size > 5 * 1024 * 1024) {
                  setError("Avatar must be 5 MB or smaller.");
                  event.target.value = "";
                  return;
                }
                setAvatar(file);
              }}
            />
          </label>
          {avatar && (
            <button
              className="remove-avatar-selection"
              type="button"
              onClick={() => {
                setAvatar(null);
                setProgress(0);
              }}
            >
              Remove selected photo
            </button>
          )}
          {save.isPending && avatar && (
            <progress className="avatar-progress" max="100" value={progress} />
          )}
          <label className="settings-field">
            <span>Username</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
            <small>This name is visible to people you chat with.</small>
          </label>
          <label className="settings-field">
            <span>Email</span>
            <input value={user.email} disabled />
            <small>Email cannot be changed from this page.</small>
          </label>
          {error && <p className="error">{error}</p>}
          {success && <p className="settings-success">{success}</p>}
          <button
            className="save-profile"
            type="submit"
            disabled={
              save.isPending ||
              (!avatar && name.trim() === user.name) ||
              name.trim().length < 2
            }
          >
            {save.isPending ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>
    </main>
  );
}
