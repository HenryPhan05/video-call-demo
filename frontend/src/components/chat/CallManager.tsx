import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { CallRecord, getCallConfig, User } from "../../api/chat";

type Phase = "idle" | "calling" | "incoming" | "connected" | "ended";
type RingingPayload = {
  call: CallRecord;
  offer?: RTCSessionDescriptionInit;
};
type Ack<T = unknown> = {
  ok: boolean;
  data?: T;
  message?: string;
};

export function CallManager({
  socket,
  conversationId,
  conversationTitle,
  user,
  enabled,
}: {
  socket: Socket | null;
  conversationId: string;
  conversationTitle?: string;
  user: User;
  enabled: boolean;
}) {
  const peer = useRef<RTCPeerConnection | null>(null);
  const activeCall = useRef<CallRecord | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingLocalIce = useRef<RTCIceCandidate[]>([]);
  const pendingRemoteIce = useRef<RTCIceCandidateInit[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [call, setCall] = useState<CallRecord | null>(null);
  const [incomingOffer, setIncomingOffer] =
    useState<RTCSessionDescriptionInit | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    localStreamRef.current = localStream;
    if (localVideo.current) localVideo.current.srcObject = localStream;
  }, [localStream, phase]);
  useEffect(() => {
    remoteStreamRef.current = remoteStream;
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
    if (remoteAudio.current) remoteAudio.current.srcObject = remoteStream;
  }, [remoteStream, phase]);
  useEffect(() => {
    if (phase !== "connected") return;
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [phase]);

  const resetMedia = () => {
    peer.current?.close();
    peer.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    pendingLocalIce.current = [];
    pendingRemoteIce.current = [];
    setMuted(false);
    setCameraOff(false);
    setSeconds(0);
  };

  const closeCall = (message?: string) => {
    resetMedia();
    activeCall.current = null;
    setIncomingOffer(null);
    setError(message ?? "");
    setPhase("ended");
    window.setTimeout(() => {
      setCall(null);
      setPhase("idle");
      setError("");
    }, 1800);
  };

  useEffect(() => {
    if (!socket) return;
    const ringing = ({
      call: nextCall, offer,
    }: RingingPayload) => {
      if (activeCall.current) return;
      activeCall.current = nextCall;
      setCall(nextCall);
      setIncomingOffer(offer ?? null);
      setPhase("incoming");
    };
    const accepted = async ({
      call: nextCall,
      answer,
    }: {
      call: CallRecord;
      answer?: RTCSessionDescriptionInit;
    }) => {
      activeCall.current = nextCall;
      setCall(nextCall);
      if (answer && peer.current) {
        await peer.current.setRemoteDescription(answer);
        await flushRemoteIce();
      }
      setPhase("connected");
    };
    const ended = () => closeCall("Call ended");
    const rejected = () => closeCall("Call declined");
    const cancelled = () => closeCall("Call cancelled");
    const ice = async ({
      candidate,
    }: {
 candidate?: RTCIceCandidateInit
}) => {
      if (!candidate) return;
      if (peer.current?.remoteDescription)
        await peer.current.addIceCandidate(candidate);
      else pendingRemoteIce.current.push(candidate);
    };
    const recovered = (nextCall: CallRecord) => {
      activeCall.current = nextCall;
      setCall(nextCall);
      setError("Previous call recovered. End it or start media again.");
      setPhase("ended");
    };
    socket.on("call:ringing", ringing);
    socket.on("call:accept", accepted);
    socket.on("call:reject", rejected);
    socket.on("call:cancel", cancelled);
    socket.on("call:end", ended);
    socket.on("webrtc:ice-candidate", ice);
    socket.on("call:recover", recovered);
    return () => {
      socket.off("call:ringing", ringing);
      socket.off("call:accept", accepted);
      socket.off("call:reject", rejected);
      socket.off("call:cancel", cancelled);
      socket.off("call:end", ended);
      socket.off("webrtc:ice-candidate", ice);
      socket.off("call:recover", recovered);
    };
  });

  const emitAck = <T, >(event: string, payload: object) =>
    new Promise<T>((resolve, reject) => {
      if (!socket)
        return reject(new Error("Realtime connection is unavailable."));
      socket.emit(event, payload, (result: Ack<T>) =>
        result.ok && result.data
          ? resolve(result.data)
          : reject(new Error(result.message ?? "Call failed.")),
      );
    });

  async function flushRemoteIce() {
    if (!peer.current?.remoteDescription) return;
    for (const candidate of pendingRemoteIce.current.splice(0))
      await peer.current.addIceCandidate(candidate);
  }

  async function createPeer(stream: MediaStream) {
    const config = await getCallConfig();
    const connection = new RTCPeerConnection(config);
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    connection.ontrack = (event) =>
      setRemoteStream(event.streams[0] ?? new MediaStream([event.track]));
    connection.onicecandidate = ({
      candidate,
    }) => {
      if (!candidate) return;
      const current = activeCall.current;
      if (current && socket)
        socket.emit("webrtc:ice-candidate", {
          callId: current.id,
          candidate: candidate.toJSON(),
        });
      else pendingLocalIce.current.push(candidate);
    };
    connection.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(connection.connectionState))
        closeCall("Connection lost");
    };
    peer.current = connection;
    return connection;
  }

  async function start(type: "VOICE" | "VIDEO") {
    if (!socket || !conversationId || phase !== "idle") return;
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "VIDEO",
      });
      setLocalStream(stream);
      setPhase("calling");
      const connection = await createPeer(stream);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const nextCall = await emitAck<CallRecord>("call:start", {
        conversationId,
        type,
        offer,
      });
      activeCall.current = nextCall;
      setCall(nextCall);
      for (const candidate of pendingLocalIce.current.splice(0))
        socket.emit("webrtc:ice-candidate", {
          callId: nextCall.id,
          candidate: candidate.toJSON(),
        });
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

  async function accept() {
    if (!socket || !call || !incomingOffer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: call.type === "VIDEO",
      });
      setLocalStream(stream);
      const connection = await createPeer(stream);
      await connection.setRemoteDescription(incomingOffer);
      await flushRemoteIce();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      const nextCall = await emitAck<CallRecord>("call:accept", {
        callId: call.id,
        answer,
      });
      activeCall.current = nextCall;
      setCall(nextCall);
      setPhase("connected");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to accept the call.",
      );
    }
  }

  async function reject() {
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
      /* peer may already be gone */
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
    if (!localStream || call?.type !== "VIDEO" || !peer.current) return;
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
    await peer.current
      .getSenders()
      .find((sender) => sender.track?.kind === "video")
      ?.replaceTrack(nextTrack);
    localStream.getVideoTracks().forEach((track) => track.stop());
    setLocalStream(
      new MediaStream([...localStream.getAudioTracks(), nextTrack]),
    );
  }

  const other = call
    ? call.callerId === user.id
      ? call.receiver
      : call.caller
    : null;
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <>
      <div className="call-launcher">
        <button
          type="button"
          disabled={!enabled || phase !== "idle"}
          onClick={() => void start("VOICE")}
          aria-label="Start voice call"
        >
          ☎
        </button>
        <button
          type="button"
          disabled={!enabled || phase !== "idle"}
          onClick={() => void start("VIDEO")}
          aria-label="Start video call"
        >
          ▣
        </button>
      </div>
      {error && phase === "idle" && <div className="call-toast">{error}</div>}
      {phase !== "idle" && (
        <div
          className={`call-overlay ${call?.type === "VIDEO" ? "video-call" : "voice-call"}`}
          role="dialog"
          aria-modal="true"
        >
          <div className="call-stage">
            {call?.type === "VIDEO" && (
              <video
                className="remote-video"
                ref={remoteVideo}
                autoPlay
                playsInline
              />
            )}
            {call?.type === "VOICE" && <audio ref={remoteAudio} autoPlay />}
            {call?.type === "VIDEO" && (
              <video
                className="local-video"
                ref={localVideo}
                autoPlay
                muted
                playsInline
              />
            )}
            <div className="call-identity">
              <span>
                {other?.avatarUrl ? (
                  <img src={`http://localhost:4000${other.avatarUrl}`} alt="" />
                ) : (
                  (other?.name ?? conversationTitle ?? "?")[0]?.toUpperCase()
                )}
              </span>
              <h2>{other?.name ?? conversationTitle ?? "Conversation"}</h2>
              <p>
                {phase === "incoming"
                  ? `Incoming ${call?.type.toLowerCase()} call`
                  : phase === "calling"
                    ? "Calling…"
                    : phase === "connected"
                      ? duration
                      : error || "Call ended"}
              </p>
            </div>
            {phase === "incoming" ? (
              <div className="incoming-actions">
                <button className="accept-call" onClick={() => void accept()}>
                  Accept
                </button>
                <button className="end-call" onClick={() => void reject()}>
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
                <button className="end-call" onClick={() => void hangUp()}>
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
