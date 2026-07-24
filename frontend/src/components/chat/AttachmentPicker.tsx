import type { ChangeEvent } from "react";

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8.8 12.8 6.1-6.1a3.2 3.2 0 0 1 4.5 4.5l-8.1 8.1a5 5 0 0 1-7.1-7.1l8.2-8.2" />
    </svg>
  );
}

export function AttachmentPicker({
  disabled = false,
  onFiles,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    if (!disabled) onFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  return (
    <label
      className={`composer-tool-button attach-button ${
        disabled ? "disabled" : ""
      }`}
      aria-label="Attach files"
      title={
        disabled ? "Finish or remove the voice message first" : "Attach files"
      }
    >
      <PaperclipIcon />
      <span className="composer-tool-label">Attach</span>
      <input
        hidden
        type="file"
        multiple
        disabled={disabled}
        onChange={change}
        accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.pdf,.doc,.docx,.xls,.xlsx,.zip,.mp3,.wav,.ogg,audio/webm"
      />
    </label>
  );
}
