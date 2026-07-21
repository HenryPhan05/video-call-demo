import { useEffect, useRef, useState } from "react";

type VoiceRecorderProps = {
  disabled?: boolean;
  onRecorded: (file: File, duration: number) => void;
  onRecordingChange?: (recording: boolean) => void;
};

export function VoiceRecorder({
  disabled = false,
  onRecorded,
  onRecordingChange,
}: VoiceRecorderProps) {
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);
  const cancelled = useRef(false);
  const recording = useRef(false);
  const releaseRequested = useRef(false);
  const recordingChange = useRef(onRecordingChange);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const animation = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyserNode = useRef<AnalyserNode | null>(null);
  const duration = useRef(0);
  const [seconds, setSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    recordingChange.current = onRecordingChange;
  }, [onRecordingChange]);
  useEffect(() => () => cleanup(), []);
  useEffect(() => {
    if (isRecording && analyserNode.current) draw(analyserNode.current);
  }, [isRecording]);

  function cleanup() {
    if (timer.current) window.clearInterval(timer.current);
    if (animation.current) cancelAnimationFrame(animation.current);
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    void audioContext.current?.close();
    recording.current = false;
    recordingChange.current?.(false);
  }

  function draw(analyser: AnalyserNode) {
    const target = canvas.current;
    if (!target || !recording.current) return;
    const context = target.getContext("2d");
    if (!context) return;
    const values = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(values);
    context.clearRect(0, 0, target.width, target.height);
    const bars = 28;
    const width = target.width / bars;
    for (let index = 0; index < bars; index += 1) {
      const value = values[Math.floor((index * values.length) / bars)] / 255;
      const height = Math.max(3, value * target.height);
      context.fillStyle = "#f02849";
      context.fillRect(
        index * width + 1,
        (target.height - height) / 2,
        Math.max(2, width - 3),
        height,
      );
    }
    animation.current = requestAnimationFrame(() => draw(analyser));
  }

  async function start() {
    if (disabled || recording.current) return;
    try {
      setError("");
      cancelled.current = false;
      releaseRequested.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;
      const next = new MediaRecorder(stream, {
        mimeType,
      });
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = () => {
        if (!cancelled.current && chunks.length) {
          const blob = new Blob(chunks, {
            type: next.mimeType || "audio/webm",
          });
          onRecorded(
            new File([blob], `voice-${Date.now()}.webm`, {
              type: blob.type,
            }),
            Math.max(1, duration.current),
          );
        }
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.current = next;
      next.start(250);
      recording.current = true;
      duration.current = 0;
      setSeconds(0);
      setIsRecording(true);
      recordingChange.current?.(true);
      timer.current = window.setInterval(() => {
        duration.current += 1;
        setSeconds(duration.current);
      }, 1000);

      const nextContext = new AudioContext();
      const analyser = nextContext.createAnalyser();
      analyser.fftSize = 128;
      nextContext.createMediaStreamSource(stream).connect(analyser);
      audioContext.current = nextContext;
      analyserNode.current = analyser;
      if (releaseRequested.current) finish(false);
    } catch {
      setError("Microphone permission is required.");
      recordingChange.current?.(false);
    }
  }

  function finish(cancel: boolean) {
    releaseRequested.current = true;
    if (
      !recording.current ||
      !recorder.current ||
      recorder.current.state === "inactive"
    )
      return;
    cancelled.current = cancel;
    recorder.current.stop();
    if (timer.current) window.clearInterval(timer.current);
    if (animation.current) cancelAnimationFrame(animation.current);
    void audioContext.current?.close();
    timer.current = null;
    animation.current = null;
    audioContext.current = null;
    analyserNode.current = null;
    recording.current = false;
    setIsRecording(false);
    recordingChange.current?.(false);
  }

  return (
    <div className="voice-recorder">
      <button
        type="button"
        className={isRecording ? "hold-record recording" : "hold-record"}
        disabled={disabled}
        title={
          disabled
            ? "Remove selected files before recording"
            : "Hold to record a voice message"
        }
        onPointerDown={() => void start()}
        onPointerUp={() => finish(false)}
        onPointerCancel={() => finish(true)}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat)
            void start();
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") finish(false);
        }}
      >
        {isRecording ? `Release · ${seconds}s` : "🎙 Hold"}
      </button>
      {isRecording && (
        <div className="recording-panel">
          <span className="recording-dot" />
          <canvas
            ref={canvas}
            width="180"
            height="32"
            aria-label="Live audio waveform"
          />
          <button
            type="button"
            className="cancel-recording"
            onClick={() => finish(true)}
          >
            Cancel
          </button>
        </div>
      )}
      {error && <small className="error">{error}</small>}
    </div>
  );
}
