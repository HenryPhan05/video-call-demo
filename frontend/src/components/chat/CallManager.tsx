import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { CallRecord, getCallConfig, User } from "../../api/chat";

type Phase = "idle" | "calling" | "incoming" | "connected" | "ended";
type Ack<T = unknown> = {
  ok: boolean;
  data?: T;
  message?: string;
};
type SignalPayload = {
  callId: string;
  fromUserId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.2 3.5 9.8 8l-2.1 2.1a15.2 15.2 0 0 0 6.2 6.2l2.1-2.1 4.5 2.6-.8 3a2 2 0 0 1-2 1.5C9.4 20.5 3.5 14.6 2.7 6.3a2 2 0 0 1 1.5-2Z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="12" height="12" rx="3" />
      <path d="m15 10 5-3v10l-5-3Z" />
    </svg>
  );
}

function RemoteMedia({
  stream,
  video,
}: {
  stream: MediaStream;
  video: boolean;
}) {
  const element = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  useEffect(() => {
    if (element.current) element.current.srcObject = stream;
  }, [stream]);

  return video ? (
    <video ref={element} autoPlay playsInline />
  ) : (
    <audio ref={element} autoPlay />
  );
}

const imageUrl = (url?: string | null) => {
  if (!url) return "";
  return /^(?:blob:|data:|https?:\/\/)/i.test(url)
    ? url
    : `http://localhost:4000${url.startsWith("/") ? "" : "/"}${url}`;
};

export function CallManager({
  socket,
  conversationId,
  conversationTitle,
  conversationAvatarUrl,
  conversationType = "DIRECT",
  user,
  enabled,
}: {
  socket: Socket | null;
  conversationId: string;
  conversationTitle?: string;
  conversationAvatarUrl?: string | null;
  conversationType?: "DIRECT" | "GROUP";
  user: User;
  enabled: boolean;
}) {
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const activeCall = useRef<CallRecord | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef(
    new Map<string, RTCIceCandidateInit[]>(),
  );
  const pendingOffers = useRef(
    new Map<string, RTCSessionDescriptionInit>(),
  );
  const accepted = useRef(false);
  const rtcConfig = useRef<RTCConfiguration | null>(null);
  const closeTimer = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [call, setCall] = useState<CallRecord | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    localStreamRef.current = localStream;
    if (localVideo.current) localVideo.current.srcObject = localStream;
  }, [localStream, phase]);

  useEffect(() => {
    if (phase !== "connected") return;
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [phase]);

  const resetMedia = () => {
    for (const connection of peers.current.values()) connection.close();
    peers.current.clear();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingIce.current.clear();
    pendingOffers.current.clear();
    accepted.current = false;
    setLocalStream(null);
    setRemoteStreams({});
    setMuted(false);
    setCameraOff(false);
    setSeconds(0);
  };

  const closeCall = (message?: string) => {
    resetMedia();
    activeCall.current = null;
    setError(message ?? "");
    setPhase("ended");
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setCall(null);
      setPhase("idle");
      setError("");
    }, 1800);
  };

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      resetMedia();
    },
    [],
  );

  const emitAck = <T,>(event: string, payload: object) =>
    new Promise<T>((resolve, reject) => {
      if (!socket)
        return reject(new Error("Realtime connection is unavailable."));
      socket.emit(event, payload, (result: Ack<T>) =>
        result.ok && result.data
          ? resolve(result.data)
          : reject(new Error(result.message ?? "Call failed.")),
      );
    });

  const removePeer = (remoteUserId: string) => {
    peers.current.get(remoteUserId)?.close();
    peers.current.delete(remoteUserId);
    pendingIce.current.delete(remoteUserId);
    pendingOffers.current.delete(remoteUserId);
    setRemoteStreams((current) => {
      const next = {
        ...current,
      };
      delete next[remoteUserId];
      return next;
    });
  };

  async function flushIce(remoteUserId: string) {
    const connection = peers.current.get(remoteUserId);
    if (!connection?.remoteDescription) return;
    for (const candidate of pendingIce.current.get(remoteUserId) ?? [])
      await connection.addIceCandidate(candidate);
    pendingIce.current.delete(remoteUserId);
  }

  async function createPeer(remoteUserId: string) {
    const existing = peers.current.get(remoteUserId);
    if (existing) return existing;
    const stream = localStreamRef.current;
    if (!stream) throw new Error("Microphone access is required.");
    if (!rtcConfig.current) rtcConfig.current = await getCallConfig();

    const connection = new RTCPeerConnection(rtcConfig.current);
    stream
      .getTracks()
      .forEach((track) => connection.addTrack(track, stream));
    connection.ontrack = (event) => {
      const remote = event.streams[0] ?? new MediaStream([event.track]);
      setRemoteStreams((current) => ({
        ...current,
        [remoteUserId]: remote,
      }));
    };
    connection.onicecandidate = ({
      candidate,
    }) => {
      const currentCall = activeCall.current;
      if (!candidate || !currentCall || !socket) return;
      socket.emit("webrtc:ice-candidate", {
        callId: currentCall.id,
        toUserId: remoteUserId,
        candidate: candidate.toJSON(),
      });
    };
    connection.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(connection.connectionState))
        removePeer(remoteUserId);
    };
    peers.current.set(remoteUserId, connection);
    return connection;
  }

  async function offerTo(remoteUserId: string) {
    if (!socket || !activeCall.current || remoteUserId === user.id) return;
    const connection = await createPeer(remoteUserId);
    if (connection.signalingState !== "stable") return;
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    socket.emit("webrtc:offer", {
      callId: activeCall.current.id,
      toUserId: remoteUserId,
      offer,
    });
  }

  async function answerOffer(
    remoteUserId: string,
    offer: RTCSessionDescriptionInit,
  ) {
    if (!socket || !activeCall.current || !accepted.current) {
      pendingOffers.current.set(remoteUserId, offer);
      return;
    }
    const connection = await createPeer(remoteUserId);
    await connection.setRemoteDescription(offer);
    await flushIce(remoteUserId);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    socket.emit("webrtc:answer", {
      callId: activeCall.current.id,
      toUserId: remoteUserId,
      answer,
    });
  }

  async function processPendingOffers() {
    for (const [remoteUserId, offer] of pendingOffers.current) {
      pendingOffers.current.delete(remoteUserId);
      await answerOffer(remoteUserId, offer);
    }
  }

  useEffect(() => {
    if (!socket) return;

    const ringing = ({
      call: nextCall,
    }: {
      call: CallRecord;
    }) => {
      if (activeCall.current) return;
      activeCall.current = nextCall;
      setCall(nextCall);
      setError("");
      setPhase("incoming");
    };
    const participantJoined = ({
      call: nextCall,
      userId: joinedUserId,
    }: {
      call: CallRecord;
      userId: string;
    }) => {
      activeCall.current = nextCall;
      setCall(nextCall);
      if (joinedUserId !== user.id && accepted.current) {
        setPhase("connected");
        void offerTo(joinedUserId).catch(() =>
          setError("A group member could not connect."),
        );
      }
    };
    const participantLeft = ({
      call: nextCall,
      userId: leftUserId,
    }: {
      call: CallRecord;
      userId: string;
    }) => {
      activeCall.current = nextCall;
      setCall(nextCall);
      removePeer(leftUserId);
    };
    const offer = ({
      fromUserId,
      offer: description,
    }: SignalPayload) => {
      if (description)
        void answerOffer(fromUserId, description).catch(() =>
          setError("Unable to connect to a group member."),
        );
    };
    const answer = ({
      fromUserId,
      answer: description,
    }: SignalPayload) => {
      const connection = peers.current.get(fromUserId);
      if (!description || !connection) return;
      void connection
        .setRemoteDescription(description)
        .then(() => flushIce(fromUserId))
        .then(() => setPhase("connected"))
        .catch(() => setError("Unable to finish the call connection."));
    };
    const ice = ({
      fromUserId,
      candidate,
    }: SignalPayload) => {
      if (!candidate) return;
      const connection = peers.current.get(fromUserId);
      if (connection?.remoteDescription)
        void connection.addIceCandidate(candidate);
      else
        pendingIce.current.set(fromUserId, [
          ...(pendingIce.current.get(fromUserId) ?? []),
          candidate,
        ]);
    };
    const ended = () => closeCall("Call ended");
    const rejected = () => closeCall("Call declined");
    const cancelled = () => closeCall("Call cancelled");
    const recovered = (nextCall: CallRecord) => {
      activeCall.current = nextCall;
      setCall(nextCall);
      setError("Previous call recovered. Close it before starting another.");
      setPhase("ended");
    };

    socket.on("call:ringing", ringing);
    socket.on("call:participant-joined", participantJoined);
    socket.on("call:participant-left", participantLeft);
    socket.on("call:reject", rejected);
    socket.on("call:cancel", cancelled);
    socket.on("call:end", ended);
    socket.on("webrtc:offer", offer);
    socket.on("webrtc:answer", answer);
    socket.on("webrtc:ice-candidate", ice);
    socket.on("call:recover", recovered);
    return () => {
      socket.off("call:ringing", ringing);
      socket.off("call:participant-joined", participantJoined);
      socket.off("call:participant-left", participantLeft);
      socket.off("call:reject", rejected);
      socket.off("call:cancel", cancelled);
      socket.off("call:end", ended);
      socket.off("webrtc:offer", offer);
      socket.off("webrtc:answer", answer);
      socket.off("webrtc:ice-candidate", ice);
      socket.off("call:recover", recovered);
    };
  });

  async function requestMedia(type: "VOICE" | "VIDEO") {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "VIDEO",
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  async function start(type: "VOICE" | "VIDEO") {
    if (!socket || !conversationId || phase !== "idle") return;
    try {
      setError("");
      await requestMedia(type);
      accepted.current = true;
      setPhase("calling");
      const nextCall = await emitAck<CallRecord>("call:start", {
        conversationId,
        type,
      });
      activeCall.current = nextCall;
      setCall(nextCall);
    } catch (cause) {
      resetMedia();
      setPhase("idle");
      setError(
        cause instanceof Error
          ? cause.message
          : "Camera or microphone permission is required.",
      );
    }
  }

  async function acceptCall() {
    if (!call) return;
    try {
      setError("");
      await requestMedia(call.type);
      accepted.current = true;
      const nextCall = await emitAck<CallRecord>("call:accept", {
        callId: call.id,
      });
      activeCall.current = nextCall;
      setCall(nextCall);
      setPhase("connected");
      await processPendingOffers();
    } catch (cause) {
      resetMedia();
      setError(
        cause instanceof Error ? cause.message : "Unable to accept the call.",
      );
    }
  }

  async function rejectCall() {
    if (!call) return;
    try {
      await emitAck<CallRecord>("call:reject", {
        callId: call.id,
      });
    } finally {
      closeCall("Call declined");
    }
  }

  async function hangUp() {
    if (!call) return closeCall();
    const event = phase === "calling" ? "call:cancel" : "call:end";
    try {
      await emitAck<CallRecord>(event, {
        callId: call.id,
      });
    } catch {
      // The server may already have closed the call.
    }
    closeCall("Call ended");
  }

  function toggleMute() {
    const next = !muted;
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCameraOff(next);
  }

  async function switchCamera() {
    if (!localStream || call?.type !== "VIDEO") return;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === "videoinput",
    );
    if (devices.length < 2) return setError("No second camera is available.");
    const currentId = localStream.getVideoTracks()[0]?.getSettings().deviceId;
    const currentIndex = devices.findIndex(
      (device) => device.deviceId === currentId,
    );
    const nextDevice = devices[(currentIndex + 1) % devices.length];
    const replacement = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: {
          exact: nextDevice.deviceId,
        },
      },
    });
    const nextTrack = replacement.getVideoTracks()[0];
    for (const connection of peers.current.values())
      await connection
        .getSenders()
        .find((sender) => sender.track?.kind === "video")
        ?.replaceTrack(nextTrack);
    localStream.getVideoTracks().forEach((track) => track.stop());
    const nextStream = new MediaStream([
      ...localStream.getAudioTracks(),
      nextTrack,
    ]);
    localStreamRef.current = nextStream;
    setLocalStream(nextStream);
  }

  const groupCall =
    call?.conversation.type === "GROUP" ||
    (!call && conversationType === "GROUP") ||
    (call?.participants.length ?? 0) > 2;
  const other = call
    ? call.callerId === user.id
      ? call.receiver
      : call.caller
    : null;
  const displayName = groupCall
    ? call?.conversation.title ?? conversationTitle ?? "Group conversation"
    : other?.name ?? conversationTitle ?? "Conversation";
  const displayAvatar = groupCall
    ? call?.conversation.groupAvatarUrl ?? conversationAvatarUrl
    : other?.avatarUrl;
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const remoteEntries = Object.entries(remoteStreams);
  const participantFor = (participantId: string) =>
    call?.participants.find(
      (participant) => participant.userId === participantId,
    );
  const joinedParticipants =
    call?.participants.filter(
      (participant) => participant.joinedAt && !participant.leftAt,
    ) ?? [];

  return (
    <>
      {enabled && phase === "idle" && (
        <div className="call-launcher" aria-label="Call options">
          <button
            className="voice-call-button"
            type="button"
            onClick={() => void start("VOICE")}
            aria-label={`Start ${groupCall ? "group " : ""}voice call`}
            title={`Start ${groupCall ? "group " : ""}voice call`}
          >
            <PhoneIcon />
            <span>Call</span>
          </button>
          <button
            className="video-call-button"
            type="button"
            onClick={() => void start("VIDEO")}
            aria-label={`Start ${groupCall ? "group " : ""}video call`}
            title={`Start ${groupCall ? "group " : ""}video call`}
          >
            <VideoIcon />
            <span>Video</span>
          </button>
        </div>
      )}
      {error && phase === "idle" && <div className="call-toast">{error}</div>}
      {phase !== "idle" && (
        <div
          className={`call-overlay ${call?.type === "VIDEO" ? "video-call" : "voice-call"} ${groupCall ? "group-call" : ""}`}
          role="dialog"
          aria-modal="true"
        >
          <div className="call-stage">
            {call?.type === "VIDEO" && remoteEntries.length > 0 && (
              <div className="group-video-grid">
                {remoteEntries.map(([participantId, stream]) => (
                  <div className="group-video-tile" key={participantId}>
                    <RemoteMedia stream={stream} video />
                    <span>
                      {participantFor(participantId)?.user.username ??
                        "Group member"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {call?.type === "VOICE" &&
              remoteEntries.map(([participantId, stream]) => (
                <RemoteMedia
                  key={participantId}
                  stream={stream}
                  video={false}
                />
              ))}
            {call?.type === "VIDEO" && localStream && (
              <video
                className="local-video"
                ref={localVideo}
                autoPlay
                muted
                playsInline
              />
            )}
            <div
              className={`call-identity ${
                call?.type === "VIDEO" && remoteEntries.length
                  ? "with-video-grid"
                  : ""
              }`}
            >
              {!(call?.type === "VIDEO" && remoteEntries.length) && (
                <span>
                  {displayAvatar ? (
                    <img src={imageUrl(displayAvatar)} alt="" />
                  ) : (
                    displayName[0]?.toUpperCase()
                  )}
                </span>
              )}
              <h2>{displayName}</h2>
              <p>
                {phase === "incoming"
                  ? `Incoming ${groupCall ? "group " : ""}${call?.type.toLowerCase()} call`
                  : phase === "calling"
                    ? "Calling…"
                    : phase === "connected"
                      ? `${duration}${groupCall ? ` · ${joinedParticipants.length} joined` : ""}`
                      : error || "Call ended"}
              </p>
            </div>
            {phase === "incoming" ? (
              <div className="incoming-actions">
                <button
                  className="accept-call"
                  onClick={() => void acceptCall()}
                >
                  Accept
                </button>
                <button
                  className="end-call"
                  onClick={() => void rejectCall()}
                >
                  Decline
                </button>
              </div>
            ) : phase !== "ended" ? (
              <div className="call-actions">
                <button onClick={toggleMute}>
                  {muted ? "Unmute" : "Mute"}
                </button>
                {call?.type === "VIDEO" && (
                  <button onClick={toggleCamera}>
                    {cameraOff ? "Camera on" : "Camera off"}
                  </button>
                )}
                {call?.type === "VIDEO" && (
                  <button onClick={() => void switchCamera()}>Switch</button>
                )}
                <button
                  className="end-call"
                  onClick={() => void hangUp()}
                >
                  End
                </button>
              </div>
            ) : (
              <div className="call-actions">
                <button
                  className="end-call"
                  onClick={() =>
                    activeCall.current ? void hangUp() : closeCall()
                  }
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
