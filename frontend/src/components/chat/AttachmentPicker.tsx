import type { ChangeEvent } from 'react';

export function AttachmentPicker({ disabled = false, onFiles }: { disabled?: boolean; onFiles: (files: File[]) => void }) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    if (!disabled) onFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  return (
    <label className={`attach-button ${disabled ? 'disabled' : ''}`} title={disabled ? 'Finish or remove the voice message first' : 'Attach files'}>
      <span>📎</span><span>Attach</span>
      <input hidden type="file" multiple disabled={disabled} onChange={change} accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.pdf,.doc,.docx,.xls,.xlsx,.zip,.mp3,.wav,.ogg,audio/webm" />
    </label>
  );
}
